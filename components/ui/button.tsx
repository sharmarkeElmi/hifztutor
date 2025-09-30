import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-extrabold tracking-wide transition disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#3dc489]",
  {
    variants: {
      variant: {
        default: "text-black bg-[#D3F501] border-2 !border-black hover:shadow-md",
        destructive: "text-white bg-rose-600 border-2 border-rose-700 hover:bg-rose-700",
        outline: "text-black bg-white border-2 !border-black hover:bg-gray-50",
        secondary: "text-black bg-gray-100 border-2 !border-black hover:bg-gray-200",
        ghost: "text-black bg-transparent border-transparent hover:bg-gray-100",
        link: "text-black underline underline-offset-4 hover:text-gray-700",
        formPrimary:
          "text-[#111629] bg-[#D3F501] border-2 !border-black uppercase tracking-wide font-bold hover:brightness-95",
      },
      size: {
        default: "h-12 px-6 py-3.5 has-[>svg]:px-5",
        sm: "h-9 rounded-sm gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-14 rounded-sm px-8 py-4 has-[>svg]:px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
