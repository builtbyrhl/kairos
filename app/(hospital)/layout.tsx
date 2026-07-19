import { AmbientProvider } from '../../lib/context/AmbientContext';
import { SessionProvider } from '../../lib/context/SessionContext';

export default function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AmbientProvider>
      <SessionProvider>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </SessionProvider>
    </AmbientProvider>
  );
}
