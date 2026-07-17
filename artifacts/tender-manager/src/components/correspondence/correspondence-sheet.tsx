import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CorrespondenceListPanel, { type CorrespondenceSourceType } from "./correspondence-list-panel";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: CorrespondenceSourceType;
  sourceId: number;
  recordLabel: string;
  governmentEntityId?: number | null;
  recordSummary?: ReactNode;
}

export default function CorrespondenceSheet({ open, onOpenChange, sourceType, sourceId, recordLabel, governmentEntityId, recordSummary }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" dir="rtl">
        <SheetHeader className="text-right">
          <SheetTitle>{recordLabel}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="correspondence" className="mt-4" dir="rtl">
          <TabsList>
            <TabsTrigger value="info">بيانات السجل</TabsTrigger>
            <TabsTrigger value="correspondence">المراسلات</TabsTrigger>
          </TabsList>
          <TabsContent value="info" className="pt-4">
            {recordSummary ?? <p className="text-sm text-muted-foreground">لا توجد بيانات إضافية</p>}
          </TabsContent>
          <TabsContent value="correspondence" className="pt-4">
            <CorrespondenceListPanel sourceType={sourceType} sourceId={sourceId} governmentEntityId={governmentEntityId} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
