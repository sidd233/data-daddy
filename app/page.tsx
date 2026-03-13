"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { AlertCircle, Info, Terminal, Zap } from "lucide-react"

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Swatch({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <div
      className={`${bg} ${fg} flex flex-col gap-0.5 rounded-md border border-border/50 px-3 py-2 font-mono text-xs`}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-60">{bg.replace("bg-", "")}</span>
    </div>
  )
}

export default function ThemePage() {
  const [sliderValue, setSliderValue] = useState([42])
  const [progress] = useState(67)
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [dark, setDark] = useState(false)

  const toggleDark = () => {
    setDark((d) => !d)
    document.documentElement.classList.toggle("dark")
  }

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight">
                Theme Preview
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                dark mode
              </span>
              <Switch
                checked={switched}
                onCheckedChange={(v) => {
                  setSwitched(v)
                  toggleDark()
                }}
              />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-10 px-6 py-10">
          {/* Color Palette */}
          <Section title="Color Tokens">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              <Swatch
                label="Background"
                bg="bg-background"
                fg="text-foreground"
              />
              <Swatch label="Card" bg="bg-card" fg="text-card-foreground" />
              <Swatch
                label="Popover"
                bg="bg-popover"
                fg="text-popover-foreground"
              />
              <Swatch
                label="Primary"
                bg="bg-primary"
                fg="text-primary-foreground"
              />
              <Swatch
                label="Secondary"
                bg="bg-secondary"
                fg="text-secondary-foreground"
              />
              <Swatch label="Muted" bg="bg-muted" fg="text-muted-foreground" />
              <Swatch
                label="Accent"
                bg="bg-accent"
                fg="text-accent-foreground"
              />
              <Swatch
                label="Destructive"
                bg="bg-destructive"
                fg="text-destructive-foreground"
              />
            </div>
          </Section>

          <Separator />

          {/* Typography */}
          <Section title="Typography">
            <div className="space-y-2">
              <p className="scroll-m-20 text-4xl font-extrabold tracking-tight">
                The quick brown fox
              </p>
              <p className="scroll-m-20 text-3xl font-semibold tracking-tight">
                jumps over the lazy dog
              </p>
              <p className="scroll-m-20 text-2xl font-semibold tracking-tight">
                Heading Three
              </p>
              <p className="scroll-m-20 text-xl font-semibold tracking-tight">
                Heading Four
              </p>
              <p className="text-base leading-7">
                Body text — regular paragraph. The theme's{" "}
                <strong>foreground color</strong> and <em>font rendering</em> at
                work. Pairs with{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                  monospace inline code
                </code>
                .
              </p>
              <p className="text-sm text-muted-foreground">
                Small muted text for captions, hints, and helper copy.
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                xs mono — timestamps, ids, labels
              </p>
            </div>
          </Section>

          <Separator />

          {/* Buttons */}
          <Section title="Buttons">
            <div className="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="lg">Large</Button>
              <Button>Default</Button>
              <Button size="sm">Small</Button>
              <Button disabled>Disabled</Button>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="outline" size="icon">
                    <Info className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Tooltip on icon button</TooltipContent>
              </Tooltip>
            </div>
          </Section>

          <Separator />

          {/* Badges */}
          <Section title="Badges">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </Section>

          <Separator />

          {/* Alerts */}
          <Section title="Alerts">
            <Alert>
              <Terminal className="h-4 w-4" />
              <AlertTitle>Default Alert</AlertTitle>
              <AlertDescription>
                This uses{" "}
                <code className="font-mono text-xs">bg-background</code> with a
                border. Great for informational messages.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Destructive Alert</AlertTitle>
              <AlertDescription>
                Something went wrong. This pulls from your destructive color
                token.
              </AlertDescription>
            </Alert>
          </Section>

          <Separator />

          {/* Card */}
          <Section title="Card">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Card Title</CardTitle>
                  <CardDescription>
                    Card description using muted foreground.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    Content area with{" "}
                    <code className="rounded bg-muted px-1 font-mono text-xs">
                      bg-card
                    </code>{" "}
                    background.
                  </p>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button size="sm">Action</Button>
                  <Button size="sm" variant="ghost">
                    Cancel
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-primary/40 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Zap className="h-4 w-4" /> Accent Card
                  </CardTitle>
                  <CardDescription>
                    Tinted with primary color alpha.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src="https://github.com/shadcn.png" />
                      <AvatarFallback>SC</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">shadcn</p>
                      <p className="text-xs text-muted-foreground">@shadcn</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* Tabs */}
          <Section title="Tabs">
            <Tabs defaultValue="controls">
              <TabsList>
                <TabsTrigger value="controls">Controls</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
                <TabsTrigger value="overlays">Overlays</TabsTrigger>
              </TabsList>

              {/* Form Controls Tab */}
              <TabsContent value="controls" className="space-y-6 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      placeholder="you@example.com"
                      type="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="framework">Framework</Label>
                    <Select>
                      <SelectTrigger id="framework">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="next">Next.js</SelectItem>
                        <SelectItem value="remix">Remix</SelectItem>
                        <SelectItem value="astro">Astro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="terms"
                      checked={checked}
                      onCheckedChange={(v) => setChecked(Boolean(v))}
                    />
                    <Label htmlFor="terms">Accept terms</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="notifs"
                      checked={switched}
                      onCheckedChange={setSwitched}
                    />
                    <Label htmlFor="notifs">Notifications</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Slider — {sliderValue[0]}%</Label>
                  <Slider
                    value={sliderValue}
                    onValueChange={(value) =>
                      setSliderValue(Array.isArray(value) ? value : [value])
                    }
                    max={100}
                    step={1}
                    className="max-w-sm"
                  />{" "}
                </div>

                <div className="space-y-2">
                  <Label>Progress — {progress}%</Label>
                  <Progress value={progress} className="max-w-sm" />
                </div>

                <div className="space-y-2">
                  <Label>Plan</Label>
                  <RadioGroup defaultValue="pro" className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="free" id="free" />
                      <Label htmlFor="free">Free</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="pro" id="pro" />
                      <Label htmlFor="pro">Pro</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="team" id="team" />
                      <Label htmlFor="team">Team</Label>
                    </div>
                  </RadioGroup>
                </div>
              </TabsContent>

              {/* Table Tab */}
              <TabsContent value="data" className="pt-4">
                <Table>
                  <TableCaption>Token reference table</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>CSS Variable</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ["primary", "--primary", "CTAs, links", "Active"],
                      ["secondary", "--secondary", "Subtle actions", "Active"],
                      ["muted", "--muted", "Backgrounds", "Active"],
                      ["accent", "--accent", "Hover states", "Active"],
                      [
                        "destructive",
                        "--destructive",
                        "Errors, deletes",
                        "Active",
                      ],
                      ["border", "--border", "Dividers, outlines", "Active"],
                    ].map(([token, css, usage, status]) => (
                      <TableRow key={token}>
                        <TableCell className="font-medium">{token}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {css}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {usage}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Overlays Tab */}
              <TabsContent value="overlays" className="space-y-4 pt-4">
                <div className="flex flex-wrap gap-3">
                  {/* Dialog */}
                  <Dialog>
                    <DialogTrigger>
                      <Button variant="outline">Open Dialog</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Dialog Title</DialogTitle>
                        <DialogDescription>
                          Tests the popover/overlay color tokens and backdrop.
                        </DialogDescription>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        Dialog content area. Background uses{" "}
                        <code className="rounded bg-muted px-1 font-mono text-xs">
                          --popover
                        </code>
                        .
                      </p>
                      <DialogFooter>
                        <Button>Confirm</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* Sheet */}
                  <Sheet>
                    <SheetTrigger>
                      <Button variant="outline">Open Sheet</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Sheet Panel</SheetTitle>
                        <SheetDescription>
                          Slides in from the right. Also uses{" "}
                          <code className="rounded bg-muted px-1 font-mono text-xs">
                            --background
                          </code>
                          .
                        </SheetDescription>
                      </SheetHeader>
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Sheet body content.
                        </p>
                        <Badge>badge inside sheet</Badge>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Popover */}
                  <Popover>
                    <PopoverTrigger>
                      <Button variant="outline">Open Popover</Button>
                    </PopoverTrigger>
                    <PopoverContent className="space-y-1 text-sm">
                      <p className="font-medium">Popover Content</p>
                      <p className="text-xs text-muted-foreground">
                        Uses{" "}
                        <code className="rounded bg-muted px-1 font-mono">
                          --popover
                        </code>{" "}
                        token.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Accordion */}
                <Accordion  className="w-full">
                  <AccordionItem value="a1">
                    <AccordionTrigger>
                      What tokens does shadcn use?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      shadcn/ui uses CSS custom properties for all color values:{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        --background
                      </code>
                      ,{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        --foreground
                      </code>
                      ,{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        --primary
                      </code>
                      , and many more — all defined in your globals.css.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="a2">
                    <AccordionTrigger>
                      How does dark mode work?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      By toggling the{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        .dark
                      </code>{" "}
                      class on{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        &lt;html&gt;
                      </code>
                      , the CSS variable values swap to their dark-mode
                      equivalents — no component changes needed.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="a3">
                    <AccordionTrigger>
                      Can I customize the theme?
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      Yes — edit the{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        :root
                      </code>{" "}
                      and{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        .dark
                      </code>{" "}
                      blocks in{" "}
                      <code className="rounded bg-muted px-1 font-mono text-xs">
                        globals.css
                      </code>
                      , or use the shadcn themes site to generate a full
                      palette.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>
            </Tabs>
          </Section>

          <Separator />

          {/* Border Radius */}
          <Section title="Border Radius">
            <div className="flex flex-wrap items-center gap-3">
              {[
                ["none", "rounded-none"],
                ["sm", "rounded-sm"],
                ["md", "rounded-md"],
                ["lg", "rounded-lg"],
                ["xl", "rounded-xl"],
                ["full", "rounded-full"],
              ].map(([label, cls]) => (
                <div
                  key={label}
                  className={`${cls} border border-border bg-muted px-4 py-2 font-mono text-xs text-muted-foreground`}
                >
                  {label}
                </div>
              ))}
            </div>
          </Section>

          <Separator />

          {/* Footer */}
          <footer className="pb-4 text-center font-mono text-xs text-muted-foreground">
            theme preview · shadcn/ui · press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">
              d
            </kbd>{" "}
            to toggle dark mode
          </footer>
        </main>
      </div>
    </TooltipProvider>
  )
}
