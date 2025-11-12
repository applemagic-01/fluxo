import express from 'express';
import { addMember, createWorkspace, getUserWorkspaces } from '../controllers/workspaceController.js';
const workspaceRouter = express.Router();

workspaceRouter.get('/',getUserWorkspaces);
workspaceRouter.post('/add-member',addMember);
workspaceRouter.post('/create',createWorkspace);



export default workspaceRouter;