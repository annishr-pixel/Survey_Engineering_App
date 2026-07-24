import Image from "next/image";
import { Card, CardBody } from "@/components/ui/card";

export interface HeroBannerProps {
  title: string;
  subtitle: string;
  imageUrl?: string;
  imageAlt?: string;
  children?: React.ReactNode;
}

export function HeroBanner({
  title,
  subtitle,
  imageUrl = "https://images.unsplash.com/photo-1497440991325-5e0e4c3bf361?w=300&h=300&fit=crop",
  imageAlt = "Solar Energy",
  children,
}: HeroBannerProps) {
  return (
    <Card className="overflow-hidden bg-gradient-to-r from-blue-50 to-green-50 border-blue-100">
      <CardBody className="p-0">
        <div className="flex flex-col lg:flex-row items-center gap-6 p-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-slate-600">{subtitle}</p>
            {children && <div className="mt-4">{children}</div>}
          </div>
          <div className="hidden lg:block flex-shrink-0">
            <div className="relative h-48 w-48 rounded-lg overflow-hidden shadow-lg">
              <Image
                src={imageUrl}
                alt={imageAlt}
                width={300}
                height={300}
                className="object-cover w-full h-full"
                priority
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
