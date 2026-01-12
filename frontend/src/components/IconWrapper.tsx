// src/components/IconWrapper.tsx (agar kerak bo'lsa)
import { LucideIcon } from 'lucide-react';

interface IconWrapperProps {
  icon: LucideIcon;
  color?: string;
  size?: number;
  className?: string;
}

export const IconWrapper: React.FC<IconWrapperProps> = ({ 
  icon: Icon, 
  color, 
  size = 24,
  className = '' 
}) => {
  return <Icon size={size} color={color} className={className} />;
};