"use server";

import { auth } from "@/lib/auth";

export const signUp = async (
    email: string,
    password: string,
    username: string
) => {
    try {
        await auth.api.signUpEmail({
            body: {
                email,
                password,
                name: username,
            },
        });

        return {
            success: true,
            message: "Signed up successfully.",
        };
    } catch (error) {
        const e = error as Error;

        return {
            success: false,
            message: e.message || "An unknown error occurred.",
        };
    }
};

export const signIn = async (email: string, password: string) => {
    try {
        await auth.api.signInEmail({
            body: {
                email,
                password,
            },
        });

        return {
            success: true,
            message: "Signed in successfully.",
        };
    } catch (error) {
        const e = error as Error;

        return {
            success: false,
            message: e.message || "An unknown error occurred.",
        };
    }
};

export const createUser = async (
    email: string,
    password: string,
    name: string,
    role?: string,
    customData?: Record<string, any>
) => {
    try {
        const newUser = await auth.api.createUser({
            body: {
                email,
                password,
                name,
                role: role || "user",
                data: customData || {},
            },
        });

        return {
            success: true,
            message: "User created successfully.",
            user: newUser,
        };
    } catch (error) {
        const e = error as Error;

        return {
            success: false,
            message: e.message || "An unknown error occurred.",
        };
    }
};