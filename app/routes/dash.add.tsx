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
  TagsInput,
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
const expenseValidation = z.object({
  title: z.string().trim().min(1, "Title is required"),
  amount: z.coerce.number().min(0, "Amount should be greater than 0"),
  description: z.string().trim().optional(),
  date: z.coerce.date(),
  accountId: z.string().min(1, "Account is required"),
  tags: z.union([
    z.array(z.string().trim().min(1, "Tag cannot be empty")),
    z
      .string()
      .trim()
      .transform((value) => 
        value.split(",")
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)
      ),
  ]),
});

export async function loader(args: ActionFunctionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/dash");
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
  return json({ tags, accounts });
}

export async function action(args: ActionFunctionArgs) {
  const request = args.request;
  const formData = await request.formData();
  console.log(formData);
  const payload = Object.fromEntries(formData);
  const result = expenseValidation.safeParse(payload);
  if (!result.success) {
    const error = result.error.flatten();

    return {
      payload,
      formErrors: error.formErrors,
      fieldErrors: error.fieldErrors,
    };
  }

  const { userId } = await getAuth(args);
  if (!userId) {
    return redirect("/dash");
  }
  console.log(result.data);

  const userTags = await db.tag.findMany({
    where: {
      userId,
    },
  });
  const tagsNotFound = result.data.tags.filter((tag) => {
    return !userTags.find((t) => t.name === tag);
  });

  const createdTags = await db.tag.createMany({
    skipDuplicates: true,
    data: tagsNotFound.map((tag) => {
      return {
        name: tag,
        userId,
      };
    }),
  });
  const tags = (
    await db.tag.findMany({
      select: {
        id: true,
      },
      where: {
        name: {
          in: result.data.tags,
        },
      },
    })
  ).map((e) => e.id);

  // Save it to db
  await db.$transaction(async (tx) => {
    // Create the expense
    const expense = await tx.expense.create({
      data: {
        amount: result.data.amount,
        title: result.data.title,
        description: result.data.description,
        userId,
        date: new Date(result.data.date),
        accountId: result.data.accountId,
        ExpenseTags: {
          createMany: {
            data: tags.map((tagId) => ({
              tagId,
            })),
          },
        },
      },
    });

    // Update account balance
    await tx.account.update({
      where: { id: result.data.accountId },
      data: {
        balance: {
          decrement: result.data.amount,
        },
      },
    });
  });
  return redirect("/dash/expenses");
}

export default function AddExpense() {
  const data = useLoaderData<typeof loader>();
  const [form, fields] = useForm({
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: expenseValidation });
    },
  });
  console.log(form.allErrors);
  return (
    <Form method="post" id={form.id} onSubmit={form.onSubmit} noValidate>
      <Container>
        <Stack>
          <Title order={3}>Add Expense</Title>
          <TextInput
            label="Title"
            key={fields.title.key}
            name={fields.title.name}
            defaultValue={fields.title.value}
            error={fields.title.errors && fields.title.errors[0]}
            placeholder="Expense title"
          />
          <Group grow>
            <NumberInput
              label="Amount"
              key={fields.amount.key}
              name={fields.amount.name}
              defaultValue={fields.amount.value}
              error={fields.amount.errors && fields.amount.errors[0]}
              placeholder="Expense amount"
              rightSection="$"
            />
            <DateInput
              label="Date"
              key={fields.date.key}
              name={fields.date.name}
              defaultValue={new Date()}
              error={fields.date.errors && fields.date.errors[0]}
            />
          </Group>
          <Textarea
            label="Description"
            key={fields.description.key}
            name={fields.description.name}
            error={fields.description.errors && fields.description.errors[0]}
            defaultValue={fields.description.value}
            placeholder="Expense description"
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
          <TagsInput
            name={fields.tags.name}
            error={fields.tags.errors && fields.tags.errors[0]}
            label="Tags"
            data={data.tags.map((e) => e.name)}
          />
          <Group justify="end">
            <Button type="submit">Save</Button>
          </Group>
        </Stack>
      </Container>
    </Form>
  );
}
