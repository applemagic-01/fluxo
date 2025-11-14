// src/features/workspaceSlice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../configs/api";

/**
 * fetchWorkspaces thunk
 * payload: { getToken, cacheBust }
 */
export const fetchWorkspaces = createAsyncThunk(
  "workspace/fetchWorkspaces",
  async ({ getToken, cacheBust } = {}, { rejectWithValue }) => {
    try {
      const token = await getToken();
      const url = `/api/workspaces${cacheBust ? `?cb=${cacheBust}` : ""}`;

      const { data } = await api.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("[fetchWorkspaces] raw response data:", data);

      // 👇 IMPORTANT: handle both `res.json(workspaces)` and `res.json({ workspaces })`
      let raw;
      if (Array.isArray(data)) {
        raw = data; // backend: res.json(workspaces)
      } else if (Array.isArray(data?.workspaces)) {
        raw = data.workspaces; // backend: res.json({ workspaces })
      } else {
        raw = [];
      }

      const workspaces = raw.map((w) => ({
        ...w,
        id: w.id || w._id || String(w._id || w.id),
      }));

      return workspaces;
    } catch (error) {
      console.error(
        "fetchWorkspaces error:",
        error?.response?.data || error?.message || error
      );
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to fetch workspaces"
      );
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
      const payload = (action.payload || []).map((w) => ({
        ...w,
        id: w.id || w._id || String(w._id || w.id),
      }));
      state.workspaces = payload;

      if (!state.currentWorkspace && payload.length > 0) {
        state.currentWorkspace = payload[0];
      }
    },

    setCurrentWorkspace: (state, action) => {
      const workspaceId = action.payload;
      state.currentWorkspace =
        state.workspaces.find(
          (w) => w.id === workspaceId || w._id === workspaceId
        ) || null;
    },

    addWorkspace: (state, action) => {
      const workspace = {
        ...action.payload,
        id: action.payload.id || action.payload._id,
      };
      state.workspaces.push(workspace);

      if (!state.currentWorkspace || state.currentWorkspace.id !== workspace.id) {
        state.currentWorkspace = workspace;
      }
    },

    updateWorkspace: (state, action) => {
      const updated = {
        ...action.payload,
        id: action.payload.id || action.payload._id,
      };
      state.workspaces = state.workspaces.map((w) =>
        w.id === updated.id ? updated : w
      );
      if (state.currentWorkspace?.id === updated.id) {
        state.currentWorkspace = updated;
      }
    },

    deleteWorkspace: (state, action) => {
      const idToDelete = action.payload;
      state.workspaces = state.workspaces.filter(
        (w) => w.id !== idToDelete && w._id !== idToDelete
      );

      if (state.currentWorkspace?.id === idToDelete) {
        state.currentWorkspace = state.workspaces[0] || null;
      }
    },

    // ---- your project & task reducers unchanged ----
    addProject: (state, action) => {
      if (!state.currentWorkspace) return;
      const project = action.payload;
      state.currentWorkspace.projects = state.currentWorkspace.projects || [];
      state.currentWorkspace.projects.push(project);

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? { ...w, projects: (w.projects || []).concat(project) }
          : w
      );
    },

    addTask: (state, action) => {
      if (!state.currentWorkspace) return;
      const task = action.payload;
      const projectId = task.projectId;

      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map(
        (p) => {
          if (p.id === projectId || p._id === projectId) {
            return { ...p, tasks: (p.tasks || []).concat(task) };
          }
          return p;
        }
      );

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: (w.projects || []).map((p) =>
                p.id === projectId || p._id === projectId
                  ? { ...p, tasks: (p.tasks || []).concat(task) }
                  : p
              ),
            }
          : w
      );
    },

    updateTask: (state, action) => {
      if (!state.currentWorkspace) return;
      const task = action.payload;
      const projectId = task.projectId;

      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map(
        (p) => {
          if (p.id === projectId || p._id === projectId) {
            return {
              ...p,
              tasks: (p.tasks || []).map((t) =>
                t.id === task.id ? task : t
              ),
            };
          }
          return p;
        }
      );

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: (w.projects || []).map((p) =>
                p.id === projectId || p._id === projectId
                  ? {
                      ...p,
                      tasks: (p.tasks || []).map((t) =>
                        t.id === task.id ? task : t
                      ),
                    }
                  : p
              ),
            }
          : w
      );
    },

    deleteTask: (state, action) => {
      if (!state.currentWorkspace) return;
      const { projectId, ids } = action.payload;
      const idList = Array.isArray(ids) ? ids : action.payload;

      state.currentWorkspace.projects = (state.currentWorkspace.projects || []).map(
        (p) => {
          if (p.id === projectId || p._id === projectId) {
            return {
              ...p,
              tasks: (p.tasks || []).filter((t) => !idList.includes(t.id)),
            };
          }
          return p;
        }
      );

      state.workspaces = state.workspaces.map((w) =>
        w.id === state.currentWorkspace.id
          ? {
              ...w,
              projects: (w.projects || []).map((p) =>
                p.id === projectId || p._id === projectId
                  ? {
                      ...p,
                      tasks: (p.tasks || []).filter(
                        (t) => !idList.includes(t.id)
                      ),
                    }
                  : p
              ),
            }
          : w
      );
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchWorkspaces.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
      const normalized = (action.payload || []).map((w) => ({
        ...w,
        id: w.id || w._id || String(w._id || w.id),
        image_url:
          w.image_url || w.logoUrl || w.image || w.logo || w.avatar || null,
        name: w.name || w.title || w.slug || "Workspace",
      }));

      state.workspaces = normalized;

      if (normalized.length > 0) {
        if (state.currentWorkspace) {
          const existing = normalized.find(
            (w) => w.id === state.currentWorkspace.id
          );
          state.currentWorkspace = existing || normalized[0];
        } else {
          state.currentWorkspace = normalized[0];
        }
      } else {
        state.currentWorkspace = null;
      }

      state.loading = false;
    });

    builder.addCase(fetchWorkspaces.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload || action.error?.message || "Failed to fetch workspaces";
    });
  },
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
  deleteTask,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
