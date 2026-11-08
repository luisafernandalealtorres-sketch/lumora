import Nav from '@/components/Nav';

export default function AppLayout({ children }) {
  return (
    <div className="wrap">
      <Nav />
      {children}
    </div>
  );
}
