import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodeMailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "fluxo" });

// Inngest function save user data to a database 
const syncUserCreation = inngest.createFunction(
    { id: 'sync-user-with-clerk' },
    { event: 'clerk/user.created' },
    async ({ event }) => {
        const { data } = event;
        await prisma.user.create({
            data: {
                id: data.id,
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

//inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    { id: 'delete-user-from-clerk' },
    { event: 'clerk/user.deleted' },
    async ({ event }) => {
        const { data } = event;
        await prisma.user.delete({
            data: {
                where: {
                    id: data.id
                }
            }
        })
    }
)
//Inngest function to update user data in database
const syncUserUpdate = inngest.createFunction(
    { id: 'update-user-from-clerk' },
    { event: 'clerk/user.updated' },
    async ({ event }) => {
        const { data } = event;
        await prisma.user.update({
            where: {
                id: data.id
            },
            data: {
                email: data?.email_addresses[0]?.email_address,
                name: data?.first_name + " " + data?.last_name,
                image: data?.image_url,
            }
        })
    }
)

// Inngest function to save workspace data to a database
const syncWorkspaceCreation = inngest.createFunction(
    { id: 'sync-workspace-from-clerk' },
    { event: 'clerk/organization.created' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.create({
            data: {
                id: data.id,
                name: data?.name,
                slug: data?.slug,
                ownerId: data?.created_by,
                image_url: data?.image_url,
            }
        })
        //add creator as admin member of the workspace
        await prisma.workspaceMember.create({
            data: {
                userId: data?.created_by,
                workspaceId: data.id,
                role: 'ADMIN',
            }
        })
    }
)

//Inngest function to update workspace data in database
const syncWorkspaceUpdate = inngest.createFunction(
    { id: 'update-workspace-from-clerk' },
    { event: 'clerk/organization.updated' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.update({
            where: {
                id: data.id
            },
            data: {
                name: data?.name,
                slug: data?.slug,
                image_url: data?.image_url,
            }
        })
    }
)

//Inngest function to delete workspace from database
const syncWorkspaceDeletion = inngest.createFunction(
    { id: 'delete-workspace-from-clerk' },
    { event: 'clerk/organization.deleted' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspace.delete({
            where: {
                id: data.id
            }
        })
    }
)

//Inngest function to save wokspace member data to a database
const syncWorkspaceMemberCreation = inngest.createFunction(
    { id: 'sync-workspace-member-from-clerk' },
    { event: 'clerk/organizationInvitation.accepted' },
    async ({ event }) => {
        const { data } = event;
        await prisma.workspaceMember.create({
            data: {
                userId: data?.user_id,
                workspaceId: data?.organization_id,
                role: String(data.role_name).toUpperCase(),
            }
        })
    }
)
//inngest function to send email on task creation
const sendTaskAssignmentEmail = inngest.createFunction(
    { id: "send-task-assignment-email" },
    { event: "app/task.assigned" },
    async ({ event, step }) => {
        const { taskId, origin } = event.data;

        const task = await prisma.task.findUnique({
            where: {
                id: taskId
            },
            include: { assignee: true, project: true }
        })

        await sendEmail({
            to: task.assignee.email,
            subject: `New task assigned to you in project ${task.project.name}`,
            body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9fb; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    <div style="background-color: #4f46e5; color: #ffffff; padding: 16px 24px; font-size: 20px; font-weight: 600;">
      New Task Assigned: ${task.title}
    </div>
    
    <div style="padding: 24px; color: #333333; line-height: 1.6;">
      <p>Hi <strong>${task.assignee.name}</strong>,</p>
      
      <p>
        You have been assigned a new task in the project 
        <strong>${task.project.name}</strong>.
      </p>
      
      <p>Please find the task details below:</p>
      
      <div style="background-color: #f3f4f6; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
        <p style="margin: 0; white-space: pre-line;">${task.description}</p>
      </div>

      <p><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</p>
      
      <div style="text-align: center; margin-top: 24px;">
        <a href="${origin}/taskDetails?projectId=${task.projectId}&taskId=${taskId}" 
           style="background-color: #4f46e5; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: 500;">
           View Task
        </a>
      </div>
      
      <p style="margin-top: 30px; font-size: 14px; color: #555;">
        Thank you for staying on top of your tasks!
        <br>
        — The Project Management Team
      </p>
    </div>
  </div>
</div>
`
        })

        if (new Date(task.due_date).toLocaleDateString() !== new Date().toLocaleDateString()) {
            await step.sleepUntil('wait-for-the-due-date', new Date(task.due_date));

            await step.run('check-if-task-is-completed', async () => {
                const task = await prisma.task.findUnique({
                    where: { id: taskId },
                    include: { assignee: true, project: true }
                })

                if (!task) return;
                if (task.status !== 'DONE') {
                    await step.run('send-task-reminder-email', async () => {
                        await sendEmail({
                            to: task.assignee.email,
                            subject: `Task ${task.title} is not completed on time`,
                            body: `<div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f9f9fb; padding: 30px;">
  <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
    
    <div style="background-color: #dc2626; color: #ffffff; padding: 16px 24px; font-size: 20px; font-weight: 600;">
      ⚠️ Task Overdue: ${task.title}
    </div>
    
    <div style="padding: 24px; color: #333333; line-height: 1.6;">
      <p>Hi <strong>${task.assignee.name}</strong>,</p>
      
      <p>
        The task <strong>${task.title}</strong> in the project 
        <strong>${task.project.name}</strong> was not completed on time.
      </p>
      
      <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
        <p style="margin: 0;">Please complete the task as soon as possible to stay on schedule and maintain project timelines.</p>
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${origin}/task/${taskId}" 
           style="background-color: #dc2626; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; display: inline-block; font-weight: 500;">
           View Task
        </a>
      </div>
      
      <p style="margin-top: 30px; font-size: 14px; color: #555;">
        This is an automated reminder. Please ensure the task is updated promptly.
        <br>
        — The Project Management Team
      </p>
    </div>
  </div>
</div>
`
                        })
                    })
                }
            })
        }
    }
)


// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdate, syncWorkspaceCreation, syncWorkspaceUpdate, syncWorkspaceDeletion, syncWorkspaceMemberCreation, sendTaskAssignmentEmail];    
