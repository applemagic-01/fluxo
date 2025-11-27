import express from 'express';
import { addMember, createProject, updateProject, deleteProject } from '../controllers/projectController.js';

const projectRouter = express.Router();

projectRouter.post('/', createProject)
projectRouter.put('/', updateProject)
projectRouter.post('/:projectId/add-member', addMember)
projectRouter.delete('/:id', deleteProject)

export default projectRouter