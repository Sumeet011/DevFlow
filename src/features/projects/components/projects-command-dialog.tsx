import { useRouter } from "next/navigation";
import { FaGithub } from "react-icons/fa";
import { AlertCircleIcon, GlobeIcon, Loader2Icon } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import { useProjects, useProjectsGithub } from "../hooks/use-projects";
import { Doc } from "../../../../convex/_generated/dataModel";

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
  
  const fetchGithubRepos = useProjectsGithub();

  // Fetch GitHub OAuth token when dialog opens for GitHub import
  useEffect(() => {
    if (open && method === "github-import") {
      fetch("/api/github-token")
        .then((res) => res.json())
        .then(async (data) => {
          setGithubToken(data.token);
          // Call the action with the token
          const repos = await fetchGithubRepos({ githubToken: data.token });
          setGithubRepos(repos || []);
        })
        .catch((error) => {
          console.error("Error fetching GitHub data:", error);
        });
    }
  }, [open, method, fetchGithubRepos]);
  

  const handleSelect = (projectId: string) => {
    router.push(`/projects/${projectId}`);
    onOpenChange(false);
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
                  {githubToken ? "Loading repositories..." : "Connecting to GitHub..."}
                </p>
              </div>
            </CommandEmpty>
          ) : (
            <CommandGroup heading="Your GitHub Repositories">
              {githubRepos.map((repo: any) => (
                <CommandItem
                  key={repo.id}
                  value={repo.full_name}
                  onSelect={() => {
                    // TODO: Import this repo
                  }}
                >
                  <FaGithub className="size-4 text-muted-foreground" />
                  <span>{repo.full_name}</span>
                </CommandItem>
              ))}
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
            >
              {getProjectIcon(project)}
              <span>{project.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
};