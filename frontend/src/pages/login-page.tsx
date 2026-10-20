import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, GraduationCap, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { HOME_PATH, ROLE_LABEL, type Role } from '@/auth/roles'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

/** Seeded accounts (see README), so reviewers can try every role in one click. */
const DEMO_ACCOUNTS: { role: Role; email: string }[] = [
  { role: 'ADMIN', email: 'admin@school.test' },
  { role: 'TEACHER', email: 'teacher@school.test' },
  { role: 'STUDENT', email: 'student@school.test' },
]
const DEMO_PASSWORD = 'Password123!'

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (status === 'authenticated' && user) {
    return <Navigate to={HOME_PATH[user.role]} replace />
  }

  const submit = async (values: LoginValues) => {
    setError(null)
    try {
      const loggedIn = await login(values.email, values.password)
      // Go back to the page that required login, if it belongs to this role.
      const from = (location.state as { from?: string } | null)?.from
      const home = HOME_PATH[loggedIn.role]
      await navigate(from?.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const loginAsDemo = (email: string) => {
    form.setValue('email', email)
    form.setValue('password', DEMO_PASSWORD)
    void form.handleSubmit(submit)()
  }

  const submitting = form.formState.isSubmitting

  return (
    <main className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <span className="bg-primary text-primary-foreground mx-auto mb-2 flex size-10 items-center justify-center rounded-lg">
            <GraduationCap className="size-6" aria-hidden />
          </span>
          <CardTitle className="text-xl">School Management</CardTitle>
          <CardDescription>Log in to your account</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(submit)(event)}
              className="flex flex-col gap-4"
              noValidate
            >
              {error && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="name@school.test"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <LoaderCircle className="animate-spin" aria-hidden />
                )}
                Log in
              </Button>
            </form>
          </Form>

          <div className="flex flex-col gap-3">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <Separator className="flex-1" />
              Demo accounts
              <Separator className="flex-1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map(({ role, email }) => (
                <Button
                  key={role}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => loginAsDemo(email)}
                >
                  {ROLE_LABEL[role] === 'Administrator'
                    ? 'Admin'
                    : ROLE_LABEL[role]}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
