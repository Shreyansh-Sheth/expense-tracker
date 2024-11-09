import { Box, Button } from "@mantine/core";
import type { MetaFunction } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Index() {
  return (
    <Box>
      <Button component={Link} to={"/dash"}>
        Dashboard
      </Button>
      <Outlet />
    </Box>
  );
}
