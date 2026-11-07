import Head from 'next/head';
import Link from 'next/link';
import { AuthForm } from '../components/ShopUi';

export default function SignUpPage() {
  return (
    <>
      <Head>
        <title>Create Account · Shop App</title>
      </Head>
      <AuthForm
        title="Create Account"
        subtitle="Your name appears in the shop header and on anything you order."
        submitPath="/api/auth/signup"
        primaryLabel="Create Account"
        fields={[
          { key: 'name', label: 'Name', type: 'text', autoComplete: 'name', placeholder: 'Your Name' },
          { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
          {
            key: 'password',
            label: 'Password',
            type: 'password',
            autoComplete: 'new-password',
            placeholder: 'At least 8 characters',
          },
        ]}
        footer={
          <p className="text-xs text-gray-400 text-center">
            Already have an account?{' '}
            <Link href="/signin" className="text-mint font-semibold">
              Sign in
            </Link>
          </p>
        }
      />
    </>
  );
}
