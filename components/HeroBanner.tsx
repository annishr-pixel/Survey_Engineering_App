import { Card, CardBody } from "@/components/ui/card";

export interface HeroBannerProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  bgGradient?: string;
}

export function HeroBanner({
  title,
  subtitle,
  children,
  bgGradient = "from-blue-50 to-green-50",
}: HeroBannerProps) {
  return (
    <Card className={`overflow-hidden bg-gradient-to-r ${bgGradient} border-blue-100`}>
      <CardBody className="p-0">
        <div className="flex flex-col items-center gap-6 p-6 text-center">
          <div className="flex-1 max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-slate-600">{subtitle}</p>
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
