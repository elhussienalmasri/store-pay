import Head from 'next/head';
import Link from 'next/link';
import { AuthForm } from '../components/ShopUi';

export default function SignInPage() {
  return (
    <>
      <Head>
        <title>Sign In · Shop App</title>
      </Head>
      <AuthForm
        title="Sign In"
        subtitle="Use your account to keep shopping with the same delivery details."
        submitPath="/api/auth/signin"
        primaryLabel="Sign In"
        fields={[
          { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', placeholder: 'you@example.com' },
          { key: 'password', label: 'Password', type: 'password', autoComplete: 'current-password', placeholder: '••••••••' },
        ]}
        footer={
          <p className="text-xs text-gray-400 text-center">
            New here?{' '}
            <Link href="/signup" className="text-mint font-semibold">
              Create an account
            </Link>
          </p>
        }
      />
    </>
  );
}
