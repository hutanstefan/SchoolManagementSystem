import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  Lock,
  Mail,
  Presentation,
  ScanLine,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { z } from 'zod'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { HOME_PATH, ROLE_LABEL, type Role } from '@/auth/roles'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import { TONE_CLASSES, type Tone } from '@/components/tones'
import { cn } from '@/lib/utils'

const loginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

type LoginValues = z.infer<typeof loginSchema>

/** Seeded accounts (see README), so reviewers can try every role in one click. */
const DEMO_ACCOUNTS: {
  role: Role
  email: string
  icon: LucideIcon
  tone: Tone
  blurb: string
}[] = [
  {
    role: 'ADMIN',
    email: 'admin@school.test',
    icon: ShieldCheck,
    tone: 'indigo',
    blurb: 'Students, teachers, classes and timetables',
  },
  {
    role: 'TEACHER',
    email: 'teacher@school.test',
    icon: Presentation,
    tone: 'violet',
    blurb: 'Mihai Ionescu · Mathematics, homeroom 9A',
  },
  {
    role: 'STUDENT',
    email: 'student@school.test',
    icon: GraduationCap,
    tone: 'emerald',
    blurb: 'Andrei Georgescu · class 9A',
  },
]
const DEMO_PASSWORD = 'Password123!'

export function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

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
    <main className="bg-background grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      <BrandPanel />

      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="rise mb-8 flex items-center gap-3 lg:hidden">
            <span className="bg-brand flex size-10 items-center justify-center rounded-xl text-white shadow-lg shadow-indigo-500/30">
              <GraduationCap className="size-5" aria-hidden />
            </span>
            <span className="font-semibold">School Management</span>
          </div>

          <div className="rise">
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Log in to see your classes, grades and timetable.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={(event) => void form.handleSubmit(submit)(event)}
              className="rise mt-8 flex flex-col gap-4"
              style={{ '--delay': '80ms' } as CSSProperties}
              noValidate
            >
              {error && (
                <Alert variant="destructive" className="animate-in fade-in">
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
                    <div className="relative">
                      <Mail
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden
                      />
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="name@school.test"
                          className="h-11 pl-9"
                          {...field}
                        />
                      </FormControl>
                    </div>
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
                    <div className="relative">
                      <Lock
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden
                      />
                      <FormControl>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          className="h-11 pr-11 pl-9"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword((shown) => !shown)}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-[3px]"
                        aria-label={
                          showPassword ? 'Hide password' : 'Show password'
                        }
                        aria-pressed={showPassword}
                      >
                        {showPassword ? (
                          <EyeOff className="size-4" aria-hidden />
                        ) : (
                          <Eye className="size-4" aria-hidden />
                        )}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="mt-2 h-11 shadow-lg shadow-indigo-500/25"
              >
                {submitting && (
                  <LoaderCircle className="animate-spin" aria-hidden />
                )}
                Log in
              </Button>
            </form>
          </Form>

          <section
            className="rise mt-10"
            style={{ '--delay': '160ms' } as CSSProperties}
            aria-labelledby="demo-accounts"
          >
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <Separator className="flex-1" />
              <h2 id="demo-accounts" className="font-medium">
                Try a demo account
              </h2>
              <Separator className="flex-1" />
            </div>
            <div className="mt-4 grid gap-2">
              {DEMO_ACCOUNTS.map(({ role, email, icon: Icon, tone, blurb }) => (
                <button
                  key={role}
                  type="button"
                  disabled={submitting}
                  onClick={() => loginAsDemo(email)}
                  aria-label={`Log in as ${ROLE_LABEL[role]}`}
                  className="group hover:border-primary/40 hover:bg-accent/40 focus-visible:ring-ring/50 flex items-center gap-3 rounded-xl border p-3 text-left transition-all outline-none hover:-translate-y-px focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-60"
                >
                  <span
                    className={cn(
                      'flex size-10 shrink-0 items-center justify-center rounded-lg',
                      TONE_CLASSES[tone],
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {ROLE_LABEL[role]}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {blurb}
                    </span>
                  </span>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-center text-xs">
              Every demo account uses the password{' '}
              <code className="bg-muted rounded px-1 py-0.5 font-mono">
                {DEMO_PASSWORD}
              </code>
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}

const FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: ClipboardList,
    title: 'Gradebook with live averages',
    text: 'Romanian rules built in: minimum grades, rounding, report cards.',
  },
  {
    icon: CalendarRange,
    title: 'School years and semesters',
    text: 'Close a year in one step: re-exams, promotion, new classes.',
  },
  {
    icon: CalendarDays,
    title: 'Timetables without clashes',
    text: 'Teacher, room and class conflicts are caught before saving.',
  },
  {
    icon: Bell,
    title: 'Notifications and chat',
    text: 'New grades and timetable changes arrive instantly.',
  },
  {
    icon: ScanLine,
    title: 'Grade a test from a photo',
    text: 'AI reads the paper; the teacher reviews before saving.',
  },
]

/** The left half on large screens: the gradient and the pitch. */
function BrandPanel() {
  return (
    <aside className="bg-brand relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div
        className="bg-grid pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div
        aria-hidden
        className="animate-float pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-fuchsia-400/30 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-float-delayed pointer-events-none absolute -bottom-32 -left-20 size-[28rem] rounded-full bg-sky-400/25 blur-3xl"
      />

      <div className="rise relative flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <span className="text-lg font-semibold">School Management</span>
      </div>

      <div className="relative my-12 max-w-lg">
        <h2
          className="rise text-4xl leading-tight font-semibold tracking-tight xl:text-5xl"
          style={{ '--delay': '60ms' } as CSSProperties}
        >
          Everything your school runs on, in one place.
        </h2>
        <ul className="mt-10 grid gap-5">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="rise flex gap-4"
              style={{ '--delay': `${140 + index * 70}ms` } as CSSProperties}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-0.5 text-sm text-white/70">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p
        className="rise relative text-sm text-white/60"
        style={{ '--delay': '480ms' } as CSSProperties}
      >
        One account per person · administrators, teachers and students
      </p>
    </aside>
  )
}
