import { useState, useEffect } from "react";
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
import { ArrowLeft, Edit2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type TaskWithPriority = {
  task: string;
  priority: Priority;
};

const Profile = () => {
  const { token, user, fetchUserProfile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [age, setAge] = useState<string>("");
  const [selectedTasks, setSelectedTasks] = useState<TaskWithPriority[]>([]);

  // Edit mode states for each field
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingRole, setEditingRole] = useState(false);
  const [editingAge, setEditingAge] = useState(false);
  const [editingTasks, setEditingTasks] = useState(false);

  // Temporary values for editing
  const [tempEmail, setTempEmail] = useState<string>("");
  const [tempRole, setTempRole] = useState<string>("");
  const [tempAge, setTempAge] = useState<string>("");
  const [tempSelectedTasks, setTempSelectedTasks] = useState<TaskWithPriority[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  // Load user profile data once on mount
  useEffect(() => {
    const loadProfile = async () => {
      if (!token) return;
      setFetching(true);
      try {
        await fetchUserProfile();
      } catch (err: any) {
        setError("Failed to load profile");
      } finally {
        setFetching(false);
      }
    };
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Populate form when user data is available
  useEffect(() => {
    if (user && !fetching) {
      const userEmail = user.email || "";
      const userRole = user.role || "";
      const userAge = user.age?.toString() || "";
      const userTasks = user.priority_tasks || [];

      setEmail(userEmail);
      setRole(userRole);
      setAge(userAge);
      setSelectedTasks(userTasks);

      // Reset temp values
      setTempEmail(userEmail);
      setTempRole(userRole);
      setTempAge(userAge);
      setTempSelectedTasks(userTasks);
    }
  }, [user, fetching]);

  const startEditingEmail = () => {
    setTempEmail(email);
    setEditingEmail(true);
  };

  const cancelEditingEmail = () => {
    setTempEmail(email);
    setEditingEmail(false);
    setError(null);
  };

  const saveEmail = async () => {
    if (!tempEmail || !tempEmail.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        email: tempEmail,
        role: role || undefined,
        age: age ? parseInt(age) : undefined,
        priority_tasks: selectedTasks.length > 0 ? selectedTasks : undefined
      });
      setEmail(tempEmail);
      setEditingEmail(false);
      setSuccess("Email updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  const startEditingRole = () => {
    setTempRole(role);
    setEditingRole(true);
  };

  const cancelEditingRole = () => {
    setTempRole(role);
    setEditingRole(false);
    setError(null);
  };

  const saveRole = async () => {
    if (!tempRole) {
      setError("Please select a role");
      return;
    }
    if (!email) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        email,
        role: tempRole,
        age: age ? parseInt(age) : undefined,
        priority_tasks: selectedTasks.length > 0 ? selectedTasks : undefined
      });
      setRole(tempRole);
      setEditingRole(false);
      setSuccess("Role updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  const startEditingAge = () => {
    setTempAge(age);
    setEditingAge(true);
  };

  const cancelEditingAge = () => {
    setTempAge(age);
    setEditingAge(false);
    setError(null);
  };

  const saveAge = async () => {
    const ageNum = parseInt(tempAge);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 150) {
      setError("Please enter a valid age (1-150)");
      return;
    }
    if (!email) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        email,
        role: role || undefined,
        age: ageNum,
        priority_tasks: selectedTasks.length > 0 ? selectedTasks : undefined
      });
      setAge(tempAge);
      setEditingAge(false);
      setSuccess("Age updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update age");
    } finally {
      setLoading(false);
    }
  };

  const startEditingTasks = () => {
    setTempSelectedTasks([...selectedTasks]);
    setEditingTasks(true);
  };

  const cancelEditingTasks = () => {
    setTempSelectedTasks([...selectedTasks]);
    setEditingTasks(false);
    setError(null);
  };

  const saveTasks = async () => {
    if (tempSelectedTasks.length < 2 || tempSelectedTasks.length > 5) {
      setError("Please select 2 to 5 tasks");
      return;
    }
    const hasInvalidPriority = tempSelectedTasks.some(
      (t) => !t.priority || !['high', 'medium', 'low'].includes(t.priority)
    );
    if (hasInvalidPriority) {
      setError("Please assign a priority to all selected tasks");
      return;
    }
    if (!email) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateProfile({
        email,
        role: role || undefined,
        age: age ? parseInt(age) : undefined,
        priority_tasks: tempSelectedTasks
      });
      setSelectedTasks([...tempSelectedTasks]);
      setEditingTasks(false);
      setSuccess("Priority tasks updated successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update priority tasks");
    } finally {
      setLoading(false);
    }
  };

  const handleTempTaskToggle = (task: string, checked: boolean) => {
    if (checked) {
      setTempSelectedTasks([...tempSelectedTasks, { task, priority: 'medium' }]);
    } else {
      setTempSelectedTasks(tempSelectedTasks.filter((t) => t.task !== task));
    }
  };

  const handleTempPriorityChange = (task: string, priority: Priority) => {
    setTempSelectedTasks(
      tempSelectedTasks.map((t) => (t.task === task ? { ...t, priority } : t))
    );
  };

  const { logout } = useAuth();

  return (
    <div className="app-background min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">User Profile</CardTitle>
            <CardDescription className="text-center">
              Update your profile information
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Reset Password Button - Moved to top */}
            <div className="mb-6 pb-6 border-b border-border">
              <Button
                variant="outline"
                onClick={() => navigate("/reset-password")}
                className="w-full"
              >
                Reset Password
              </Button>
            </div>

            {fetching ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Loading profile...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                    {success}
                  </div>
                )}

                {/* Email Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Email</Label>
                    {!editingEmail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditingEmail}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingEmail ? (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        value={tempEmail}
                        onChange={(e) => setTempEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full"
                        disabled={loading}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveEmail}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingEmail}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-2">{email || "Not set"}</p>
                  )}
                </div>

                {/* Role Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Who are you?</Label>
                    {!editingRole && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditingRole}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingRole ? (
                    <div className="space-y-2">
                      <RadioGroup value={tempRole} onValueChange={setTempRole} className="mt-2">
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveRole}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingRole}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-2 capitalize">{role || "Not set"}</p>
                  )}
                </div>

                {/* Age Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Age</Label>
                    {!editingAge && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditingAge}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingAge ? (
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min="1"
                        max="150"
                        value={tempAge}
                        onChange={(e) => setTempAge(e.target.value)}
                        placeholder="Enter your age"
                        className="w-full"
                        disabled={loading}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveAge}
                          disabled={loading}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingAge}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground py-2">{age || "Not set"}</p>
                  )}
                </div>

                {/* Priority Tasks Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">
                      Priority Tasks
                    </Label>
                    {!editingTasks && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={startEditingTasks}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {editingTasks ? (
                    <div className="space-y-3">
                      <div className="space-y-3 border rounded-md p-4">
                        {taskOptions.map((option) => {
                          const isSelected = tempSelectedTasks.some((t) => t.task === option);
                          const selectedTask = tempSelectedTasks.find((t) => t.task === option);

                          return (
                            <div key={option} className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`task-${option}`}
                                  checked={isSelected}
                                  onCheckedChange={(checked) =>
                                    handleTempTaskToggle(option, checked === true)
                                  }
                                  disabled={loading}
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
                                      handleTempPriorityChange(option, value)
                                    }
                                    disabled={loading}
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
                      {tempSelectedTasks.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Selected: {tempSelectedTasks.length} task{tempSelectedTasks.length !== 1 ? 's' : ''} (Minimum: 2, Maximum: 5)
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveTasks}
                          disabled={loading || tempSelectedTasks.length < 2 || tempSelectedTasks.length > 5}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditingTasks}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTasks.length > 0 ? (
                        <div className="space-y-2">
                          {selectedTasks.map((item) => (
                            <div key={item.task} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                              <span className="capitalize">{item.task}</span>
                              <span className="text-sm text-muted-foreground capitalize">({item.priority})</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground py-2">No priority tasks set</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;

