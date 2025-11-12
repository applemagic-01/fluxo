// src/components/WorkspaceDropdown.jsx
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { setCurrentWorkspace } from "../features/workspaceSlice";
import { useNavigate } from "react-router-dom";
import { useClerk, useOrganizationList } from "@clerk/clerk-react";

const getLogo = (ws) => {
  if (!ws) return null;
  return ws.image_url || ws.logoUrl || ws.image || ws.logo || ws.avatar || null;
};

const WorkspaceDropdown = () => {
  // read loading as well so we can avoid showing placeholder while fetching
  const { workspaces = [], currentWorkspace = null, loading = false } = useSelector((s) => s.workspace || {});
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [imgErrorMap, setImgErrorMap] = useState({});

  // Clerk hooks (setActive might not exist depending on the hook; guard its use)
  const orgList = typeof useOrganizationList === "function" ? useOrganizationList({ userMemberships: true }) : {};
  const setActive = orgList?.setActive;
  const isOrgListLoaded = orgList?.isLoaded ?? true;

  const { openCreateOrganization } = useClerk();

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Debug logs (remove in prod)
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.debug("[WorkspaceDropdown] workspaces count:", workspaces.length, "loading:", loading);
    // eslint-disable-next-line no-console
    console.debug("[WorkspaceDropdown] currentWorkspace:", currentWorkspace);
  }, [workspaces, currentWorkspace, loading]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reconcile localStorage saved id with workspaces when they arrive
  useEffect(() => {
    // If we already have a currentWorkspace or still loading, do nothing
    if (currentWorkspace || loading) return;

    // If workspaces are present, try to pick localStorage id or first one
    if (Array.isArray(workspaces) && workspaces.length > 0) {
      const savedId = localStorage.getItem("currentWorkspaceId");
      let found = null;
      if (savedId) {
        found = workspaces.find(w => w.id === savedId || w._id === savedId);
      }
      if (!found) {
        // If the user has only one workspace, auto-select it.
        if (workspaces.length === 1) {
          found = workspaces[0];
        } else {
          // if multiple and no savedId, do nothing
          return;
        }
      }

      // dispatch the object (supports setCurrentWorkspace accepting either id or full object)
      if (found) {
        // If your reducer supports receiving the full object, you can pass found,
        // otherwise pass found.id — your reducer patch from earlier supports both.
        dispatch(setCurrentWorkspace(found));
      }
    }
  }, [workspaces, currentWorkspace, loading, dispatch]);

  // When currentWorkspace changes, optionally call Clerk setActive if available
  useEffect(() => {
    if (!currentWorkspace) return;
    if (typeof setActive === "function" && isOrgListLoaded) {
      try {
        setActive({ organization: currentWorkspace.id || currentWorkspace._id });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[WorkspaceDropdown] setActive threw:", e);
      }
    }
  }, [currentWorkspace, setActive, isOrgListLoaded]);

  const onSelectWorkspace = (workspaceId) => {
    // guard and call Clerk setActive if available
    if (typeof setActive === "function") {
      try {
        setActive({ organization: workspaceId });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[WorkspaceDropdown] setActive error:", e);
      }
    }

    // update redux and navigate
    dispatch(setCurrentWorkspace(workspaceId));
    setIsOpen(false);
    navigate("/");
  };

  const renderLogo = (ws, size = 32) => {
    const logoUrl = getLogo(ws);
    const key = ws?.id ?? ws?._id ?? ws?.slug ?? ws?.name;

    if (logoUrl && !imgErrorMap[key]) {
      return (
        <img
          src={logoUrl}
          alt={ws?.name || "Workspace"}
          onError={() => setImgErrorMap((p) => ({ ...p, [key]: true }))}
          style={{ width: size, height: size, objectFit: "cover", borderRadius: 6 }}
        />
      );
    }

    const initials = (ws?.name || "W")
      .split(" ")
      .map((p) => p.charAt(0))
      .slice(0, 2)
      .join("")
      .toUpperCase();

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#EEF2FF",
          color: "#3730A3",
          fontWeight: 700,
        }}
      >
        {initials}
      </div>
    );
  };

  // --- Render ---
  // If workspaces are loading (fetch in progress) show a tiny placeholder so user doesn't see "Select Workspace"
  // You can replace this with a proper skeleton or spinner.
  const headerName = currentWorkspace?.name ?? (loading ? "" : "Select Workspace");
  const headerLogo = currentWorkspace ? renderLogo(currentWorkspace, 32) : (loading ? <div style={{ width: 32, height: 32 }} /> : <div className="w-8 h-8 rounded bg-gray-100 dark:bg-zinc-800" />);

  return (
    <div className="relative m-4" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((p) => !p)}
        className="w-full flex items-center justify-between p-3 h-auto text-left rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: 32, height: 32 }}>{headerLogo}</div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 dark:text-white text-sm truncate">
              {headerName}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
              {workspaces.length} workspace{workspaces.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded shadow-lg top-full left-0">
          <div className="p-2 max-h-72 overflow-y-auto">
            <p className="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2 px-2">Workspaces</p>

            {workspaces.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-gray-500 dark:text-zinc-400">No workspaces yet</div>
            )}

            {workspaces.map((ws) => {
              const wsId = ws.id || ws._id || ws.slug || ws.name;
              const isActive = (currentWorkspace && (currentWorkspace.id || currentWorkspace._id) === (ws.id || ws._id));

              return (
                <div
                  key={wsId}
                  onClick={() => onSelectWorkspace(wsId)}
                  className="flex items-center gap-3 p-2 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-zinc-800"
                  role="button"
                  tabIndex={0}
                >
                  <div style={{ width: 24, height: 24 }}>{renderLogo(ws, 24)}</div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{ws.name || ws.title || "Workspace"}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{(ws.membersCount ?? ws.members?.length ?? 0)} members</p>
                  </div>

                  {isActive && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          <hr className="border-gray-200 dark:border-zinc-700" />

          <div
            className="p-2 cursor-pointer rounded group hover:bg-gray-100 dark:hover:bg-zinc-800"
            onClick={() => { openCreateOrganization(); setIsOpen(false); }}
            role="button"
            tabIndex={0}
          >
            <p className="flex items-center text-xs gap-2 my-1 w-full text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300">
              <Plus className="w-4 h-4" /> Create Workspace
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceDropdown;
