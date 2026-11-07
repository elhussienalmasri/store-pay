import React from 'react';
import { AuthForm } from '../components/AuthForm';
import { AuthLayout } from '../components/AuthLayout';

export default function LoginPage() {
  return (
    <AuthLayout title="Sign in">
      <AuthForm mode="login" />
    </AuthLayout>
  );
}
