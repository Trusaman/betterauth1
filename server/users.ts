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
