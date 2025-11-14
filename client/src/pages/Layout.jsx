import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import { useUser, SignIn, useAuth, CreateOrganization, useClerk } from '@clerk/clerk-react'
import api from '../configs/api'
import { setWorkspaces } from '../features/workspaceSlice'

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  const { loading, workspaces } = useSelector((state) => state.workspace)
  const dispatch = useDispatch()
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const clerk = useClerk()
  const navigate = useNavigate()

  const pollingRef = useRef(false)
  const redirectedRef = useRef(false)
  const mountedRef = useRef(true)
  const controllerRef = useRef(null)

  useEffect(() => {
    dispatch(loadTheme())
  }, [dispatch])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (controllerRef.current) controllerRef.current.abort()
    }
  }, [])


  const isStillLoadingWorkspace =
    !isLoaded ||                  // Clerk not ready
    loading ||                    // Redux loading
    (!workspaces ||               // No workspace loaded yet
      workspaces.length === 0) && // Empty but we haven’t finished polling
    !redirectedRef.current &&     // No redirect yet
    !pollingRef.current           // Polling hasn’t finished yet


  useEffect(() => {
    if (!isLoaded || !user) return
    if (workspaces.length > 0) return
    if (pollingRef.current) return

    pollingRef.current = true
    let attempt = 0
    const maxAttempts = 12
    let cancelled = false

    const poll = async () => {
      if (!mountedRef.current || redirectedRef.current || cancelled) return
      attempt++

      controllerRef.current = new AbortController()
      try {
        const token = await getToken()

        const res = await api.get(`/api/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { cb: Date.now() },
          signal: controllerRef.current.signal,
          validateStatus: () => true,
        })

        const raw =
          res.data?.workspaces ??
          (Array.isArray(res.data) ? res.data : [])
        
        const normalized = raw.map(w => ({
          ...w,
          id: w.id || w._id || String(w._id || w.id)
        }))

        if (normalized.length > 0) {
          dispatch(setWorkspaces(normalized))
          redirectedRef.current = true
          navigate('/')
          cancelled = true
          return
        }
      } catch (err) {}

      if (attempt >= maxAttempts) {
        // No workspaces at all → now safe to show CreateOrganization
        cancelled = true
        return
      }

      setTimeout(() => !cancelled && poll(), 700 * Math.pow(1.6, attempt))
    }

    poll()

    return () => {
      pollingRef.current = false
    }
  }, [isLoaded, user, workspaces, navigate, getToken, dispatch])



  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen bg-white dark:bg-zinc-950">
        <SignIn />
      </div>
    )
  }

  // FIX: Show loader while deciding workspace existence
  if (isStillLoadingWorkspace) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
        <Loader2Icon className="size-7 text-blue-500 animate-spin" />
      </div>
    )
  }

  // After polling finishes and still no workspaces → show CreateOrganization
  if (workspaces.length === 0) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <CreateOrganization
          afterCreateOrganizationUrl={window.location.origin + '/'}
        />
      </div>
    )
  }

  return (
    <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
      <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col h-screen">
        <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
        <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default Layout
