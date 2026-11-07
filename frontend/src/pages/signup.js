import React from 'react';
import { AuthForm } from '../components/AuthForm';
import { AuthLayout } from '../components/AuthLayout';

export default function SignupPage() {
  return (
    <AuthLayout title="Create account">
      <AuthForm mode="signup" />
    </AuthLayout>
  );
}
