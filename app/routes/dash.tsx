import {
  SignedIn,
  SignedOut,
  SignInButton,
  RedirectToSignIn,
} from "@clerk/remix";
import { Box, Button, Container } from "@mantine/core";
import { Outlet } from "@remix-run/react";
import { HeaderTabs } from "~/components/header";
import "@mantine/charts/styles.css";
import "@mantine/dates/styles.css";

export default function Dash() {
  return (
    <>
      <SignedIn>
        <Box>
          <HeaderTabs />
          <Outlet />
        </Box>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
