import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../configs/api";

/**
 * fetchWorkspaces thunk
 * - uses getToken() to get bearer token
 * - Normalizes each workspace to contain `id` (from `id` or `_id`)
 * - Throws on error so caller can detect failure (instead of silently returning [])
 */
export const fetchWorkspaces = createAsyncThunk(
  'workspace/fetchWorkspaces',
  /**
   * payload: { getToken, cacheBust }
   */
  async ({ getToken, cacheBust } = {}, { rejectWithValue }) => {
    try {
      const token = await getToken(); // always await fresh token
      // attach cacheBust to avoid cached responses
      const url = `/api/workspaces${cacheBust ? `?cb=${cacheBust}` : ''}`;

      const { data } = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const raw = data?.workspaces || [];
      const workspaces = raw.map(w => ({ ...w, id: w.id || w._id || String(w._id || w.id) }));
      return workspaces;
    } catch (error) {
      console.error('fetchWorkspaces error:', error?.response?.data || error?.message || error);
      return rejectWithValue(error?.response?.data?.message || error?.message || 'Failed to fetch workspaces');
    }
  }
);

const initialState = {
  workspaces: [],
  currentWorkspace: null,
  loading: false,
  error: null,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setWorkspaces: (state, action) => {
      // Ensure normalized ids
      const payload = action.payload.map(w => ({ ...w, id: w.id || w._id }));
      state.workspaces = payload;
    },
    setCurrentWorkspace: (state, action) => {
      const workspaceId = action.payload;
      localStorage.setItem("currentWorkspaceId", workspaceId);
      state.currentWorkspace = state.workspaces.find((w) => w.id === workspaceId) || null;
    },
    addWorkspace: (state, action) => {
      const workspace = { ...action.payload, id: action.payload.id || action.payload._id };
      state.workspaces.push(workspace);
      // set current workspace to the new workspace if none or different
      if (!state.currentWorkspace || state.currentWorkspace.id !== workspace.id) {
        state.currentWorkspace = workspace;
        localStorage.setItem("currentWorkspaceId", workspace.id);
      }
    },
    updateWorkspace: (state, action) => {
      const updated = { ...action.payload, id: action.payload.id || action.payload._id };
      state.workspaces = state.workspaces.map((w) => (w.id === updated.id ? updated : w));
      if (state.currentWorkspace?.id === updated.id) {
        state.currentWorkspace = updated;
      }
    },
    deleteWorkspace: (state, action) => {
      // action.payload expected to be the id string
      const idToDelete = action.payload;
      state.workspaces = state.workspaces.filter((w) => w.id !== idToDelete && w._id !== idToDelete);
      if (state.currentWorkspace?.id === idToDelete) {
        state.currentWorkspace = state.workspaces[0] || null;
        localStorage.setItem("currentWorkspaceId", state.currentWorkspace?.id || "");
      }
    },
    addProject: (state, action) => {
      if (!state.currentWorkspace) return;
      const project = action.payload;
      // ensure projects array exists
      state.currentWorkspace.projects = state.currentWorkspace.projects || [];
      state.currentWorkspace.projects.push(project);

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id ? { ...w, projects: (w.projects || []).concat(project) } : w
      );
    },
    addTask: (state, action) => {
      if (!state.currentWorkspace) return;
      const task = action.payload;
      const projectId = task.projectId;

      // update currentWorkspace in place
      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map((p) => {
        if (p.id === projectId || p._id === projectId) {
          return { ...p, tasks: (p.tasks || []).concat(task) };
        }
        return p;
      });

      // update in workspaces list
      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id ? {
          ...w,
          projects: (w.projects || []).map((p) =>
            (p.id === projectId || p._id === projectId) ? { ...p, tasks: (p.tasks || []).concat(task) } : p
          )
        } : w
      );
    },
    updateTask: (state, action) => {
      if (!state.currentWorkspace) return;
      const task = action.payload;
      const projectId = task.projectId;

      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map((p) => {
        if (p.id === projectId || p._id === projectId) {
          return { ...p, tasks: (p.tasks || []).map((t) => (t.id === task.id ? task : t)) };
        }
        return p;
      });

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id ? {
          ...w,
          projects: (w.projects || []).map((p) =>
            (p.id === projectId || p._id === projectId) ? { ...p, tasks: (p.tasks || []).map((t) => (t.id === task.id ? task : t)) } : p
          )
        } : w
      );
    },
    deleteTask: (state, action) => {
      if (!state.currentWorkspace) return;
      // action.payload: { projectId, ids: [taskId1, taskId2] } or array of ids
      const { projectId, ids } = action.payload;
      const idList = Array.isArray(ids) ? ids : action.payload; // backward compat

      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map((p) => {
        if (p.id === projectId || p._id === projectId) {
          return { ...p, tasks: (p.tasks || []).filter((t) => !idList.includes(t.id)) };
        }
        return p;
      });

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id ? {
          ...w,
          projects: (w.projects || []).map((p) =>
            (p.id === projectId || p._id === projectId) ? { ...p, tasks: (p.tasks || []).filter((t) => !idList.includes(t.id)) } : p
          )
        } : w
      );
    }
  },
  extraReducers: (builder) => {
    builder.addCase(fetchWorkspaces.pending, (state) => {
  state.loading = true;
  state.error = null;
});

builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
  // normalize ids and image fields if needed
  const normalized = (action.payload || []).map(w => ({
    ...w,
    id: w.id || w._id || String(w._id || w.id),
    // optional: normalize image field for sidebar
    image_url: w.image_url || w.logoUrl || w.image || w.logo || w.avatar || null,
    name: w.name || w.title || w.slug || 'Workspace'
  }));

  state.workspaces = normalized;

  if (normalized.length > 0) {
    const savedId = localStorage.getItem('currentWorkspaceId');
    // try to find the saved one first (support _id or id)
    let found = null;
    if (savedId) {
      found = normalized.find(w => w.id === savedId || w._id === savedId);
    }
    // if not found, pick the first workspace
    if (!found) {
      found = normalized[0];
    }
    state.currentWorkspace = found;
    // persist chosen id
    if (found && found.id) localStorage.setItem('currentWorkspaceId', found.id);
  } else {
    state.currentWorkspace = null;
    localStorage.removeItem('currentWorkspaceId');
  }

  state.loading = false;
});

builder.addCase(fetchWorkspaces.rejected, (state, action) => {
  state.loading = false;
  state.error = action.payload || action.error?.message || 'Failed to fetch workspaces';
});
  }
});

export const {
  setWorkspaces,
  setCurrentWorkspace,
  addWorkspace,
  updateWorkspace,
  deleteWorkspace,
  addProject,
  addTask,
  updateTask,
  deleteTask
} = workspaceSlice.actions;
export default workspaceSlice.reducer;
