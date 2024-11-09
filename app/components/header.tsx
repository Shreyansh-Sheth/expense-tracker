import {
  Box,
  Burger,
  Button,
  Container,
  Group,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
// import { MantineLogo } from "@mantinex/mantine-logo";
import { UserButton } from "@clerk/remix";
import { Link, NavLink, useLocation } from "@remix-run/react";
import classes from "./HeaderTabs.module.css";

const user = {
  name: "Jane Spoonfighter",
  email: "janspoon@fighter.dev",
  image:
    "https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-5.png",
};

// const tabs = ["Home", "Expenses", "Accounts"];
const tabs = [
  {
    name: "Home",
    url: "/dash/home",
  },
  {
    name: "Income",
    url: "/dash/income",
  },
  {
    name: "Expenses",
    url: "/dash/expenses",
  },
  {
    name: "Accounts",
    url: "/dash/accounts",
  },
];

export function HeaderTabs() {
  const theme = useMantineTheme();
  const [opened, { toggle }] = useDisclosure(false);
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const location = useLocation();

  const items = tabs.map((tab) => (
    <Button component={NavLink} variant="subtle" to={tab.url} key={tab.name}>
      {tab.name}
    </Button>
  ));

  return (
    <div className={classes.header}>
      <Container className={classes.mainSection} size="md">
        <Group justify="space-between">
          <Title>Manage Expenses</Title>
          <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
          <UserButton />
        </Group>
      </Container>
      <Container size="md">
        <Group justify="space-between" mb="xs">
          <Box>{items}</Box>
          <Group>
            <Button to="/dash/add-income" component={Link}>
              Add Income
            </Button>
            <Button to="/dash/add" component={Link}>
              Add Expense
            </Button>
          </Group>
        </Group>
      </Container>
    </div>
  );
}
