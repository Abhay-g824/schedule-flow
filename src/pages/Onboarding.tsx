import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Priority } from "@/types/task";

type TaskWithPriority = {
  task: string;
  priority: Priority;
};

const Onboarding = () => {
  const { token, fetchUserProfile } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [selectedTasks, setSelectedTasks] = useState<TaskWithPriority[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const handleTaskToggle = (task: string, checked: boolean) => {
    if (checked) {
      // Add task with default priority 'medium'
      setSelectedTasks([...selectedTasks, { task, priority: 'medium' }]);
    } else {
      // Remove task
      setSelectedTasks(selectedTasks.filter((t) => t.task !== task));
    }
  };

  const handlePriorityChange = (task: string, priority: Priority) => {
    setSelectedTasks(
      selectedTasks.map((t) => (t.task === task ? { ...t, priority } : t))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!role || !age) {
      setError("Please fill in all fields");
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
      setError("Please enter a valid age");
      return;
    }

    if (selectedTasks.length < 2 || selectedTasks.length > 5) {
      setError("Please select 2 to 5 tasks");
      return;
    }

    // Validate all tasks have priorities
    const hasInvalidPriority = selectedTasks.some(
      (t) => !t.priority || !['high', 'medium', 'low'].includes(t.priority)
    );
    if (hasInvalidPriority) {
      setError("Please assign a priority to all selected tasks");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/user/onboarding`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role,
          age: ageNum,
          priority_tasks: selectedTasks,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save onboarding data");
      }

      // Refresh user profile to update onboarding status
      await fetchUserProfile();

      // Redirect to home page after successful onboarding
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const taskOptions = [
    "assignment",
    "meeting",
    "class",
    "bank work",
    "project",
    "exam",
    "deadline",
    "appointment",
    "other",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center app-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Welcome! Let's get started</CardTitle>
          <CardDescription className="text-center">
            Please answer a few questions to personalize your experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-base font-semibold">
                Who are you?
              </Label>
              <RadioGroup value={role} onValueChange={setRole} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="student" id="student" />
                  <Label htmlFor="student" className="font-normal cursor-pointer">
                    Student
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="teacher" id="teacher" />
                  <Label htmlFor="teacher" className="font-normal cursor-pointer">
                    Teacher
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="employee" id="employee" />
                  <Label htmlFor="employee" className="font-normal cursor-pointer">
                    Employee
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="others" id="others" />
                  <Label htmlFor="others" className="font-normal cursor-pointer">
                    Others
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="age" className="text-base font-semibold">
                Age
              </Label>
              <Input
                id="age"
                type="number"
                min="1"
                max="150"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Enter your age"
                className="w-full"
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">
                What tasks will you prioritize? (Select 2-5 tasks)
              </Label>
              <div className="space-y-3 border rounded-md p-4">
                {taskOptions.map((option) => {
                  const isSelected = selectedTasks.some((t) => t.task === option);
                  const selectedTask = selectedTasks.find((t) => t.task === option);
                  
                  return (
                    <div key={option} className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`task-${option}`}
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleTaskToggle(option, checked === true)
                          }
                        />
                        <Label
                          htmlFor={`task-${option}`}
                          className="font-normal cursor-pointer flex-1"
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </Label>
                      </div>
                      {isSelected && (
                        <div className="ml-7">
                          <Select
                            value={selectedTask?.priority || 'medium'}
                            onValueChange={(value: Priority) =>
                              handlePriorityChange(option, value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedTasks.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} (Minimum: 2, Maximum: 5)
                </p>
              )}
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={
                loading ||
                !role ||
                !age ||
                selectedTasks.length < 2 ||
                selectedTasks.length > 5
              }
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Onboarding;

