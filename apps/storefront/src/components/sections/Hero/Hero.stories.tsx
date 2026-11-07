import type { Meta, StoryObj } from "@storybook/react"

import { heroSlides } from "@/data/heroSlides"
import { Hero } from "./Hero"

/**
 * Storybook preview of the home hero carousel (developer tool — run `bun run storybook`).
 * The live site reads its slides from src/data/heroSlides.ts, not from this file.
 */
const meta: Meta<typeof Hero> = {
  component: Hero,
  decorators: (Story) => <Story />,
}

export default meta
type Story = StoryObj<typeof Hero>

export const Carousel: Story = {
  args: { slides: heroSlides },
}

export const SingleSlide: Story = {
  args: { slides: heroSlides.slice(0, 1) },
}
