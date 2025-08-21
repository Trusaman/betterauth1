"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient();

export function WrapperWithQuery(props: { children: React.ReactNode | any }) {
    return (
        <QueryClientProvider client={queryClient}>
            {props.children}
            {/* <ReactQueryDevtoolsPanel /> */}
        </QueryClientProvider>
    );
}
