import { getAuth } from "@clerk/remix/ssr.server";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import {
  Button,
  Container,
  Group,
  NumberInput,
  Stack,
  Table,
  TextInput,
  Title,
} from "@mantine/core";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import { z } from "zod";
import { db } from "~/utils/db";

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  balance: z.coerce.number().min(0, "Balance must be positive"),
});

export async function loader(args: LoaderFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { request } = args;
  const accounts = await db.account.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return json({ accounts });
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");

  const formData = await args.request.formData();
  const result = accountSchema.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return json({ error: result.error.flatten() });
  }

  await db.account.create({
    data: {
      ...result.data,
      userId,
    },
  });

  return redirect("/dash/expenses");
}

export default function Accounts() {
  const { accounts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: accountSchema });
    },

});

  return (
    <Container size="xl" mt="md">
      <Stack>
        <Title order={3}>Accounts</Title>
        
        <Form 
    
        method="post" id={form.id} onSubmit={form.onSubmit}>
          <Stack>
            <Group grow>
              <TextInput
                label="Account Name"
                name={fields.name.name}
                error={fields.name.errors?.[0]}
              />
              <NumberInput
                label="Initial Balance"
                name={fields.balance.name}
                error={fields.balance.errors?.[0]}
                rightSection="$"
              />
            </Group>
            <Group justify="flex-end">
              <Button type="submit">Add Account</Button>
            </Group>
          </Stack>
        </Form>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Balance</Table.Th>
              <Table.Th>Created At</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.map((account) => (
              <Table.Tr key={account.id}>
                <Table.Td>{account.name}</Table.Td>
                <Table.Td>${account.balance.toFixed(2)}</Table.Td>
                <Table.Td>
                  {new Date(account.createdAt).toLocaleDateString()}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Container>
  );
} 