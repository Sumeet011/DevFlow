import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { AlertCircleIcon, GlobeIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

import { useProjects, useProjectsGithub, useDeleteProject } from "../hooks/use-projects";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import {useImportGithubProject} from "../hooks/use-projects"

interface ProjectsCommandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?:"github-import" | "normal-view";
};

const getProjectIcon = (project: Doc<"projects">) => {
  if (project.importStatus === "completed") {
    return <FaGithub className="size-4 text-muted-foreground" />
  }

  if (project.importStatus === "failed") {
    return <AlertCircleIcon className="size-4 text-muted-foreground" />;
  }

  if (project.importStatus === "importing") {
    return (
      <Loader2Icon className="size-4 text-muted-foreground animate-spin" />
    );
  }

  return <GlobeIcon className="size-4 text-muted-foreground" />;
}


export const ProjectsCommandDialog = ({
  open,
  onOpenChange,
  method = "normal-view",
}: ProjectsCommandDialogProps) => {
  const router = useRouter();
  const projects = useProjects();
  const { getToken } = useAuth();
  const [githubToken, setGithubToken] = useState<string | undefined>();
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  
  const fetchGithubRepos = useProjectsGithub();
  const importGithubProject = useImportGithubProject();
  const deleteProject = useDeleteProject();

  // Fetch GitHub OAuth token when dialog opens for GitHub import
  useEffect(() => {
    if (open && method === "github-import") {
      fetch("/api/github-token")
        .then((res) => {
          return res.json();
        })
        .then(async (data) => {
          if (data.error) {
            toast.error(data.error);
            setGithubRepos([]);
            return;
          }
          
          if (!data.token) {
            toast.error("GitHub not connected. Please reconnect your GitHub account.");
            setGithubRepos([]);
            return;
          }
          
          setGithubToken(data.token);
          
          try {
            // Call the action with the token
            const repos = await fetchGithubRepos({ githubToken: data.token });
            setGithubRepos(repos || []);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to fetch GitHub repositories");
            setGithubRepos([]);
          }
        })
        .catch((error) => {
          toast.error("Failed to connect to GitHub. Please try again.");
          setGithubRepos([]);
        });
    }
  }, [open, method, fetchGithubRepos]);
  

  const handleImportGithubProject = async (repoFullName: string) => {
    if (!githubToken) {
      toast.error("No GitHub token available");
      return;
    }

    if (importingRepo) {
      toast.error("Already importing a repository");
      return;
    }

    try {
      setImportingRepo(repoFullName);
      const toastId = toast.loading(`Importing ${repoFullName}...`);
      

      
      const projectId = await importGithubProject({
        githubToken,
        projectimportId: repoFullName,
      });


      
      toast.dismiss(toastId);
      toast.success("Repository imported successfully!");

      // Navigate to the new project
      if (projectId) {
        router.push(`/projects/${projectId}`);
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import repository");
    } finally {
      setImportingRepo(null);
    }
  };

  const handleSelect = (projectId: string) => {
    router.push(`/projects/${projectId}`);
    onOpenChange(false);
  };

  const handleDeleteProject = async (projectId: Id<"projects">, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await deleteProject({ id: projectId });
      toast.success(`Project "${projectName}" deleted successfully`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  // GitHub import view
  if (method === "github-import") {
    return (
      <CommandDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Import from GitHub"
        description="Select a repository to import"
      >
        <CommandInput placeholder="Search repositories..." />
        <CommandList>
          {githubRepos.length === 0 ? (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 py-6">
                <FaGithub className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {githubToken ? "No accessible repositories found" : "Connecting to GitHub..."}
                </p>
                {githubToken && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground text-center max-w-xs">
                      Make sure your GitHub account has repositories and you've granted the necessary permissions.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Open Clerk user profile to manage connected accounts
                        window.Clerk?.openUserProfile();
                      }}
                      className="mt-2"
                    >
                      <FaGithub className="size-4 mr-2" />
                      Manage GitHub Connection
                    </Button>
                  </div>
                )}
              </div>
            </CommandEmpty>
          ) : (
            <CommandGroup heading="Your GitHub Repositories">
              {githubRepos.map((repo: any) => {
                const isImporting = importingRepo === repo.full_name;
                
                return (
                  <CommandItem
                    key={repo.id}
                    value={repo.full_name}
                    className='cursor-pointer'
                    disabled={importingRepo !== null}
                    onSelect={() => handleImportGithubProject(repo.full_name)}
                  >
                    {isImporting ? (
                      <Loader2Icon className="size-4 text-muted-foreground animate-spin" />
                    ) : (
                      <FaGithub className="size-4 text-muted-foreground" />
                    )}
                    <div className="flex flex-col">
                      <span>{repo.full_name}</span>
                      {repo.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-xs">
                          {repo.description}
                        </span>
                      )}
                    </div>
                    {repo.private && (
                      <span className="ml-auto text-xs text-muted-foreground">Private</span>
                    )}
                    
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    );
  }

  // Normal projects view
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Projects"
      description="Search and navigate to your projects"
    >
      <CommandInput placeholder="Search projects..." />
      <CommandList>
        <CommandEmpty>No projects found.</CommandEmpty>
        <CommandGroup heading="Projects">
          {projects?.map((project) => (
            <CommandItem
              key={project._id}
              value={`${project.name}-${project._id}`}
              onSelect={() => handleSelect(project._id)}
              className="group"
            >
              {getProjectIcon(project)}
              <span>{project.name}</span>
              <button
                onClick={(e) => handleDeleteProject(project._id, project.name, e)}
                className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                title="Delete project"
              >
                <Trash2Icon className="size-4 text-destructive" />
              </button>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
};