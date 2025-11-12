import prisma from "../configs/prisma.js";

//get all workspaces for a user
export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const workspaces = await prisma.workspace.findMany({
            where: {
                members: {
                    some: { userId: userId }
                },
            },
            include: {
                members: { include: { user: true } },
                projects: {
                    include: {
                        tasks: { include: { assignee: true, comments: { include: { user: true } } } },
                        members:{include:{user:true}}
                    }
                }
            },
        });
        res.json(workspaces)
    } catch (error) {
        console.log(error)
        res.status(500).json({ message:error.code || error.message });
    }
}

//create a new workspace
export const createWorkspace = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { name, organizationId } = req.body;

        if (!name || !organizationId) {
            return res.status(400).json({ message: 'Workspace name and organization ID are required' });
        }

        const newWorkspace = await prisma.workspace.create({
            data: {
                name,
                organizationId,
                members: {
                    create: {
                        userId,
                        role: 'ADMIN',
                    },
                },
            },
            include: {
                members: { include: { user: true } },
                projects: {
                    include: {
                        tasks: { include: { assignee: true, comments: { include: { user: true } } } },
                        members:{include:{user:true}}
                    }
                }
            },
        });
        res.status(201).json(newWorkspace);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
}


//add member to a workspace
export const addMember = async (req,res) => {
    try {
        const {userId} = await req.auth();
        const {email,role,workspaceId,message} = req.body;

        //check if user exist
        const user = await prisma.user.findUnique({where:{email}});

        if(!user){
            return res.status(404).json({ message: 'User not found' });
        }
        if(!workspaceId || !role){
            return res.status(400).json({ message: 'Workspace ID and role are required' });
        }
        if(!['ADMIN','MEMBER'].includes(role)){
            return res.status(400).json({ message: 'Role must be ADMIN or MEMBER' });
        }
        //fetch workspace
        const workspace = await prisma.workspace.findUnique({where:{id:workspaceId},include:{members:true}});
        if(!workspace){
            return res.status(404).json({ message: 'Workspace not found' });
        }
        // check for creators admin role
        if(!workspace.members.find((member)=>member.userId === userId && member.role ==='ADMIN')){
            return res.status(401).json({message:"You don't have permission to add members to this workspace"});
        }
        // check is user is already a member
        const existingMember = workspace.members.find((member)=>member.userId === user.id);
        if(existingMember){
            return res.status(400).json({ message: 'User is already a member of this workspace' });
        }
        const member = await prisma.workspaceMember.create({
            data:{
                userId:user.id,
                workspaceId,
                role,
                message
            }
        })
        res.json({message:'Member added successfully',member});
    } catch (error) {
        console.log(error)
        res.status(500).json({ message:error.code || error.message });
    }
}