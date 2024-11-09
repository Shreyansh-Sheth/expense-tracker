import { getAuth } from "@clerk/remix/ssr.server";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import {
  Button,
  Container,
  Group,
  NumberInput,
  Select,
  Stack,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import "@mantine/dates/styles.css";
import { ActionFunctionArgs, redirect } from "@remix-run/node";
import { Form, json, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { db } from "~/utils/db";

const incomeValidation = z.object({
  title: z.string().trim().min(1, "Title is required"),
  amount: z.coerce.number().min(0, "Amount should be greater than 0"),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  accountId: z.string().min(1, "Account is required"),
});

export async function loader(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/dash");
  }
  const accounts = await db.account.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  return json({ accounts });
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/dash");
  }

  const formData = await args.request.formData();
  const result = incomeValidation.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return json({ error: result.error.flatten() });
  }

  await db.$transaction(async (tx) => {
    // Create the income
    await tx.income.create({
      data: {
        amount: result.data.amount,
        title: result.data.title,
        description: result.data.description,
        userId,
        date: new Date(result.data.date),
        accountId: result.data.accountId,
      },
    });

    // Update account balance
    await tx.account.update({
      where: { id: result.data.accountId },
      data: {
        balance: {
          increment: result.data.amount,
        },
      },
    });
  });

  return redirect("/dash/income");
}

export default function AddIncome() {
  const data = useLoaderData<typeof loader>();
  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: incomeValidation });
    },
  });

  return (
    <Form method="post" id={form.id} onSubmit={form.onSubmit} noValidate>
      <Container>
        <Stack>
          <Title order={3}>Add Income</Title>
          <TextInput
            label="Title"
            name={fields.title.name}
            error={fields.title.errors?.[0]}
            placeholder="Income title"
          />
          <Group grow>
            <NumberInput
              label="Amount"
              name={fields.amount.name}
              error={fields.amount.errors?.[0]}
              placeholder="Income amount"
              rightSection="$"
            />
            <DateInput
              label="Date"
              name={fields.date.name}
              defaultValue={new Date()}
              error={fields.date.errors?.[0]}
            />
          </Group>
          <Textarea
            label="Description"
            name={fields.description.name}
            error={fields.description.errors?.[0]}
            placeholder="Income description"
          />
          <Select
            label="Account"
            name={fields.accountId.name}
            error={fields.accountId.errors?.[0]}
            data={data.accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
            required
          />
          <Group justify="end">
            <Button type="submit">Save</Button>
          </Group>
        </Stack>
      </Container>
    </Form>
  );
}
