//create task

import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";

export const createTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId, title, description, type, status, priority, assigneeId, due_date } = req.body;
        const origin = req.get('origin');

        //check if user has a admin role for the project 
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not authorized to create a task in this project" })
        } else if (assigneeId && !project.members.find((member) => member.user.id === assigneeId)) {
            return res.status(403).json({ message: "Assignee is not a member of the project/workspace" })
        }

        const task = await prisma.task.create({
            data: {
                project,
                title,
                description,
                priority,
                assigneeId,
                status,
                due_date: new Date(due_date)
            }
        })
        const taskWithAssignee = await prisma.task.findUnique({
            where: { id: task.id },
            include: { assignee: true }
        })
        await inngest.send({
            name:'app/task.assigned',
            data:{
                taskId:task.id,
                origin
            }
        })
        res.json({ task: taskWithAssignee, message: "Task created successfully" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message })
    }
}

//update task
export const updateTask = async (req, res) => {
    try {

        const task = await prisma.task.findUnique({
            where:{id:req.params.id}
        })
        if(!task){
            return res.status(404).json({ message: "Task not found" })
        }
        const { userId } = await req.auth();

       
        const project = await prisma.project.findUnique({
            where: { id: task.projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not authorized to update a task in this project" })
        }

        const updatedTask = await prisma.task.update({
            where:{id:req.params.id},
            data:req.body
        })

        res.json({ task: updateTask, message: "Task updated successfully" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message })
    }
}

//delete task
export const deleteTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const {taskIds} = req.body;
        const tasks = await prisma.task.findMany({
            where:{id:{in:taskIds}}
        })
        if(tasks.length === 0){
            return res.status(404).json({ message: "Task not found" })
        }

       
        const project = await prisma.project.findUnique({
            where: { id: tasks[0].projectId },
            include: { members: { include: { user: true } } }
        })

        if (!project) {
            return res.status(404).json({ message: "Project not found" })
        } else if (project.team_lead !== userId) {
            return res.status(403).json({ message: "You are not authorized to delete a task in this project" })
        }
        await prisma.task.deleteMany({
            where:{id:{in:taskIds}}
        })


        res.json({ message: "Task deleted successfully" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message })
    }
}
