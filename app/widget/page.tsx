import { WidgetForm } from "@/components/widget-form"

export default function WidgetPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold">Contact SendDesk</h2>
            <p className="text-sm text-muted-foreground mt-1">We typically respond within 24 hours</p>
          </div>
          <WidgetForm />
        </div>
      </div>
    </div>
  )
}
