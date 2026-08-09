import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Bölüm 8: her veri çeken ekran loading/error/empty durumlarının üçünü de ele
// almalı — bunları atlamak demoyu "bozuk" gösteren en yaygın sebep.

export function LoadingState({ label = 'Yükleniyor...' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3 py-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-3/4" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Bir şeyler ters gitti</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onRetry}>
            Tekrar dene
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center text-muted-foreground">
      <Inbox className="h-8 w-8" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
