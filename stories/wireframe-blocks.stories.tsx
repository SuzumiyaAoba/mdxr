import type { Meta, StoryObj } from "@storybook/react-vite";

import { Wireframe } from "../src/ui/wireframe-layout.js";
import { WireframeContactForm } from "../src/ui/wireframe-library-contact-form.js";
import { WireframeDashboard } from "../src/ui/wireframe-library-dashboard.js";
import { WireframeHeroSection } from "../src/ui/wireframe-library-hero-section.js";
import { WireframeLoginForm } from "../src/ui/wireframe-library-login-form.js";
import { WireframePricing } from "../src/ui/wireframe-library-pricing.js";
import { WireframeProductGrid } from "../src/ui/wireframe-library-product-grid.js";
import { WireframeProfilePage } from "../src/ui/wireframe-library-profile-page.js";
import { WireframeRegisterForm } from "../src/ui/wireframe-library-register-form.js";
import { WireframeSettingsPage } from "../src/ui/wireframe-library-settings-page.js";

const meta = {
  component: Wireframe,
  title: "Components/Wireframe/Blocks",
} satisfies Meta<typeof Wireframe>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HeroSection: Story = {
  render: () => (
    <Wireframe title="hero-section">
      <WireframeHeroSection />
    </Wireframe>
  ),
};
export const LoginForm: Story = {
  render: () => (
    <Wireframe title="login-form">
      <WireframeLoginForm />
    </Wireframe>
  ),
};
export const RegisterForm: Story = {
  render: () => (
    <Wireframe title="register-form">
      <WireframeRegisterForm />
    </Wireframe>
  ),
};
export const ContactForm: Story = {
  render: () => (
    <Wireframe title="contact-form">
      <WireframeContactForm />
    </Wireframe>
  ),
};
export const Dashboard: Story = {
  render: () => (
    <Wireframe title="dashboard">
      <WireframeDashboard />
    </Wireframe>
  ),
};
export const Pricing: Story = {
  render: () => (
    <Wireframe title="pricing">
      <WireframePricing />
    </Wireframe>
  ),
};
export const ProductGrid: Story = {
  render: () => (
    <Wireframe title="product-grid">
      <WireframeProductGrid />
    </Wireframe>
  ),
};
export const ProfilePage: Story = {
  render: () => (
    <Wireframe title="profile-page">
      <WireframeProfilePage />
    </Wireframe>
  ),
};
export const SettingsPage: Story = {
  render: () => (
    <Wireframe title="settings-page">
      <WireframeSettingsPage />
    </Wireframe>
  ),
};
