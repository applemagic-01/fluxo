import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "fluxo" });

// Inngest function save user data to a database 
const syncUserCreation = inngest.createFunction(
    {id:'sync-user-with-clerk'},
    {event:'clerk/user.created'},
    async({event})=>{
        const {data} = event;
        await prisma.user.create({
            data:{
                id:data.id,
                email:data?.email_addresses[0]?.email_address,
                name: data?.first_name+" "+data?.last_name,
                image:data?.image_url,
            }
        })
    }
)

//inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
    {id:'delete-user-from-clerk'},
    {event:'clerk/user.deleted'},
    async({event})=>{
        const {data} = event;
        await prisma.user.delete({
            data:{
                where:{
                    id:data.id
                }
            }
        })
    }
)
//Inngest function to update user data in database
const syncUserUpdate = inngest.createFunction(
    {id:'update-user-from-clerk'},
    {event:'clerk/user.updated'},
    async({event})=>{
        const {data} = event;
        await prisma.user.update({
            where:{
                id:data.id
            },
            data:{
                email:data?.email_addresses[0]?.email_address,
                name: data?.first_name+" "+data?.last_name,
                image:data?.image_url,
            }
        })
    }
)

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUserCreation,syncUserDeletion,syncUserUpdate];