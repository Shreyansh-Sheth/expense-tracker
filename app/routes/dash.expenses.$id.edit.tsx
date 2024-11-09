import { getAuth } from "@clerk/remix/ssr.server";
import React from "react";
import { useForm } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod";
import {
  Button,
  Container,
  Group,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  TextInput,
  Textarea,
  Title,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { db } from "~/utils/db";
const expenseValidation = z.object({
  title: z.string().trim().min(1, "Title is required"),
  amount: z.coerce.number().min(0, "Amount should be greater than 0"),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  accountId: z.string().min(1, "Account is required"),
  tags: z.union([
    z.array(z.string().trim().min(1, "Tag cannot be empty")),
    z.string()
      .trim()
      .transform((value) => 
        value.split(",")
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      ),
  ]),
});

export async function loader(args: LoaderFunctionArgs) {
  console.log("loader");
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");
  const { params } = args;
  const expense = await db.expense.findFirst({
    where: {
      id: params.id,
      userId,
    },
    include: {
      ExpenseTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!expense) {
    return redirect("/dash/expenses");
  }

  const [tags, accounts] = await Promise.all([
    db.tag.findMany({
      where: { userId },
      select: { name: true },
    }),
    db.account.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);

  return json({
    expense: {
      ...expense,
      tags: expense.ExpenseTags.map(et => et.tag.name),
    },
    tags,
    accounts,
  });
}

export async function action(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) return redirect("/");

  const { params, request } = args; 
  const formData = await request.formData();
  const result = expenseValidation.safeParse(Object.fromEntries(formData));

  if (!result.success) {
    return json({ error: result.error.flatten() });
  }

  const expense = await db.expense.findFirst({
    where: {
      id: params.id,
      userId,
    },
    include: {
      account: true,
    },
  });

  if (!expense) {
    return redirect("/dash/expenses");
  }

  const userTags = await db.tag.findMany({
    where: { userId },
  });

  const tagsNotFound = result.data.tags.filter((tag) => {
    return !userTags.find((t) => t.name === tag);
  });

  await db.$transaction(async (tx) => {
    // Create any new tags
    if (tagsNotFound.length > 0) {
      await tx.tag.createMany({
        skipDuplicates: true,
        data: tagsNotFound.map((tag) => ({
          name: tag,
          userId,
        })),
      });
    }

    // Get all tag IDs
    const tags = await tx.tag.findMany({
      where: {
        name: {
          in: result.data.tags,
        },
      },
      select: { id: true },
    });

    // If account changed, update old and new account balances
    if (expense.accountId !== result.data.accountId) {
      // Add amount back to old account
      await tx.account.update({
        where: { id: expense.accountId! },
        data: { balance: { increment: expense.amount } },
      });

      // Subtract from new account
      await tx.account.update({
        where: { id: result.data.accountId },
        data: { balance: { decrement: result.data.amount } },
      });
    } else if (expense.amount !== result.data.amount) {
      // If only amount changed, adjust current account
      const difference = expense.amount - result.data.amount;
      await tx.account.update({
        where: { id: expense.accountId! },
        data: { balance: { increment: difference } },
      });
    }

    // Update expense and tags
    await tx.expense.update({
      where: { id: params.id },
      data: {
        amount: result.data.amount,
        title: result.data.title,
        description: result.data.description,
        date: result.data.date,
        accountId: result.data.accountId,
        ExpenseTags: {
          deleteMany: {},
          createMany: {
            data: tags.map((tag) => ({
              tagId: tag.id,
            })),
          },
        },
      },
    });
  });

  return redirect("/dash/expenses");
}

export default function EditExpense() {
  const { expense, tags, accounts } = useLoaderData<typeof loader>();
  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: expenseValidation });
    },
  });

  return (
    <Form method="post" id={form.id} onSubmit={form.onSubmit} noValidate>
      <Container>
        <Stack>
          <Title order={3}>Edit Expense</Title>
          <TextInput
            label="Title"
            name={fields.title.name}
            defaultValue={expense.title}
            error={fields.title.errors?.[0]}
            placeholder="Expense title"
          />
          <Group grow>
            <NumberInput
              label="Amount"
              name={fields.amount.name}
              defaultValue={expense.amount}
              error={fields.amount.errors?.[0]}
              placeholder="Expense amount"
              rightSection="$"
            />
            <DateInput
              label="Date"
              name={fields.date.name}
              defaultValue={new Date(expense.date)}
              error={fields.date.errors?.[0]}
            />
          </Group>
          <Textarea
            label="Description"
            name={fields.description.name}
            defaultValue={expense.description || ""}
            error={fields.description.errors?.[0]}
            placeholder="Expense description"
          />
          <Select
            label="Account"
            name={fields.accountId.name}
            defaultValue={expense.accountId || undefined}
            error={fields.accountId.errors?.[0]}
            data={accounts.map((account) => ({
              value: account.id,
              label: account.name,
            }))}
            required
          />
          <TagsInput
            name={fields.tags.name}
            defaultValue={expense.tags}
            error={fields.tags.errors?.[0]}
            label="Tags"
            data={tags.map((e) => e.name)}
          />
          <Group justify="end">
            <Button type="submit">Update</Button>
          </Group>
        </Stack>
      </Container>
    </Form>
  );
}
