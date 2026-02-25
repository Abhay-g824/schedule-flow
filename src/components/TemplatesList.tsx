import { useState } from "react";
import { useTemplates } from "@/hooks/useTemplates";
import { useTasks } from "@/hooks/useTasks";
import { TaskTemplate } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { FileText, Plus, Trash2, Calendar, Clock, Flag } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const priorityColors: Record<string, string> = {
  high: "text-priority-high",
  medium: "text-priority-medium",
  low: "text-priority-low",
};

const priorityLabels: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function TemplatesList() {
  const { templates, loading, createTaskFromTemplate, deleteTemplate } = useTemplates();
  const { fetchTasks } = useTasks();
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleUseTemplate = async (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setIsDatePickerOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (!selectedTemplate) return;
    try {
      await createTaskFromTemplate(selectedTemplate.id, dueDate);
      await fetchTasks();
      setIsDatePickerOpen(false);
      setSelectedTemplate(null);
      setDueDate(undefined);
    } catch (err) {
      console.error("Failed to create task from template", err);
    }
  };

  const handleDeleteClick = (templateId: string) => {
    setTemplateToDelete(templateId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      await deleteTemplate(templateToDelete);
      setTemplateToDelete(null);
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete template", err);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading templates...</p>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-sm">No templates yet</p>
        <p className="text-xs mt-1">Save a task as a template to use it here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-foreground truncate">{template.title}</h4>
                    {template.color && (
                      <div
                        className="h-3 w-3 rounded-full border border-border flex-shrink-0"
                        style={{ backgroundColor: template.color }}
                      />
                    )}
                  </div>
                  
                  {template.description && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {template.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 flex-wrap text-xs">
                    <div className={cn("flex items-center gap-1", priorityColors[template.priority])}>
                      <Flag className="h-3 w-3" />
                      <span>{priorityLabels[template.priority]}</span>
                    </div>
                    
                    {template.timeSlotStart && template.timeSlotEnd && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(template.timeSlotStart, "h:mm a")} - {format(template.timeSlotEnd, "h:mm a")}
                        </span>
                      </div>
                    )}

                    {template.category && (
                      <span className="text-muted-foreground">• {template.category}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleUseTemplate(template)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Use
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteClick(template.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Date Picker Dialog */}
      <Dialog open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task from Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate && `Creating task: ${selectedTemplate.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Due Date (Optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => setDueDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDatePickerOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmCreate}>
                Create Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}



