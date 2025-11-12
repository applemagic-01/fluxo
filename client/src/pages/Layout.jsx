import { useState, useEffect, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import { useUser, SignIn, useAuth, CreateOrganization, useClerk } from '@clerk/clerk-react'
import api from '../configs/api' // axios instance
import { setWorkspaces } from '../features/workspaceSlice' // action to set workspaces

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { loading, workspaces } = useSelector((state) => state.workspace)
  const dispatch = useDispatch()
  const { user, isLoaded } = useUser()
  const { getToken } = useAuth()
  const clerk = useClerk()
  const navigate = useNavigate()

  // guards & refs to avoid spurious aborts / re-runs
  const pollingRef = useRef(false)
  const redirectedRef = useRef(false)
  const controllerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    dispatch(loadTheme())
  }, [dispatch])

  // track real mount/unmount so we only abort on real unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (controllerRef.current) {
        controllerRef.current.abort()
      }
    }
  }, [])

  // If workspaces are already present (normal), navigate once
  useEffect(() => {
    if (isLoaded && user && Array.isArray(workspaces) && workspaces.length > 0 && !redirectedRef.current) {
      redirectedRef.current = true
      navigate('/') // change to '/dashboard' if desired
    }
  }, [workspaces, isLoaded, user, navigate])

  // Polling effect: single-run, uses controllerRef and mountedRef
  useEffect(() => {
    if (!isLoaded || !user) return
    if (Array.isArray(workspaces) && workspaces.length > 0) return
    if (pollingRef.current) return

    pollingRef.current = true
    let attempt = 0
    const maxAttempts = 12
    let cancelled = false

    const attemptFetch = async () => {
      if (!mountedRef.current || redirectedRef.current || cancelled) return
      attempt += 1
      const cb = Date.now()
      console.info(`[workspace-poll] attempt ${attempt} - cb=${cb}`)

      // create a fresh controller for this attempt and store in ref
      controllerRef.current = new AbortController()
      try {
        const token = await getToken()
        console.info('[workspace-poll] token present:', !!token, 'len:', token?.length || 0)

        const res = await api.get(`/api/workspaces`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { cb },
          signal: controllerRef.current.signal,
          validateStatus: () => true
        })

        console.info('[workspace-poll] status', res.status, 'data', res.data)

        const raw = (res.data && res.data.workspaces) ? res.data.workspaces : (Array.isArray(res.data) ? res.data : [])
        const normalized = raw.map(w => ({ ...w, id: w.id || w._id || String(w._id || w.id) }))

        if (normalized.length > 0) {
          // success: set store and navigate immediately
          dispatch(setWorkspaces(normalized))
          redirectedRef.current = true
          navigate('/') // or '/dashboard'
          cancelled = true
          return
        }

        if (res.status >= 400) {
          console.warn('[workspace-poll] server responded with error status', res.status, res.data)
        }
      } catch (err) {
        // handle abort vs real errors
        if (err.name === 'CanceledError' || err.name === 'AbortError') {
          console.warn('[workspace-poll] request aborted (ignored)')
        } else {
          console.error('[workspace-poll] fetch error', err)
        }
      } finally {
        // clear controller for this attempt
        controllerRef.current = null
      }

      if (!mountedRef.current || redirectedRef.current || cancelled) return

      if (attempt >= maxAttempts) {
        console.warn('[workspace-poll] max attempts reached — fallback redirect')
        try {
          if (!redirectedRef.current && clerk && typeof clerk.redirectToOrganizationProfile === 'function') {
            redirectedRef.current = true
            await clerk.redirectToOrganizationProfile()
            cancelled = true
            return
          }
        } catch (e) {
          console.warn('clerk.redirectToOrganizationProfile failed', e)
        }

        if (!redirectedRef.current) {
          redirectedRef.current = true
          window.location.href = '/onboarding-done'
        }
        cancelled = true
        return
      }

      // exponential backoff before next attempt
      const delay = Math.min(5000, 700 * Math.pow(1.6, attempt))
      setTimeout(() => {
        if (!cancelled) attemptFetch()
      }, delay)
    }

    attemptFetch()

    return () => {
      // do not abort here to avoid cancelling in dev-mode re-runs;
      // real abort is handled by the mountedRef cleanup above.
      pollingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user])

  // UI rendering
  if (!user) {
    return (
      <div className='flex justify-center items-center h-screen bg-white dark:bg-zinc-950'>
        <SignIn />
      </div>
    )
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-screen bg-white dark:bg-zinc-950'>
        <Loader2Icon className="size-7 text-blue-500 animate-spin" />
      </div>
    )
  }

  if (user && (!Array.isArray(workspaces) || workspaces.length === 0)) {
    return (
      <div className='min-h-screen flex items-center justify-center'>
        <CreateOrganization afterCreateOrganizationUrl={window.location.origin + '/'} />
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
