import { TopLoadingBar } from "./LoadingBar";

export default function WebrisDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopLoadingBar />
      {children}
    </>
  );
}
