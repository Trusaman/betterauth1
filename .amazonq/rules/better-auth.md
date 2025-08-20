1. Sign Up
To sign up a user you need to call the client method signUp.email with the user's information.
import { authClient } from "@/lib/auth-client"; //import the auth client
 
const { data, error } = await authClient.signUp.email({
        email, // user email address
        password, // user password -> min 8 characters by default
        name, // user display name
        image, // User image URL (optional)
        callbackURL: "/dashboard" // A URL to redirect to after the user verifies their email (optional)
    }, {
        onRequest: (ctx) => {
            //show loading
        },
        onSuccess: (ctx) => {
            //redirect to the dashboard or sign in page
        },
        onError: (ctx) => {
            // display the error message
            alert(ctx.error.message);
        },
});

2. Sign In with client
To sign a user in, you can use the signIn.email function provided by the client.

const { data, error } = await authClient.signIn.email({
        /**
         * The user email
         */
        email,
        /**
         * The user password
         */
        password,
        /**
         * A URL to redirect to after the user verifies their email (optional)
         */
        callbackURL: "/dashboard",
        /**
         * remember the user session after the browser is closed. 
         * @default true
         */
        rememberMe: false
}, {
    //callbacks
})

3. Sign In with server
Server-Side Authentication
To authenticate a user on the server, you can use the auth.api methods.

server.ts

import { auth } from "./auth"; // path to your Better Auth server instance
 
const response = await auth.api.signInEmail({
    body: {
        email,
        password
    },
    asResponse: true // returns a response object instead of data
});

