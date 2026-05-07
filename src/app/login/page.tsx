import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" aria-label="SurveyOS home">
            <Logo variant="light" size="md" />
          </Link>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
