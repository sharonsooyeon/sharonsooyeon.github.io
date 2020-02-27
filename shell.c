/**
 * CS 240 Shell Spells
 * Chetna Mahajan and Sharon Kim
 * Implemented: Part I, Part II, Part III
 */

#include <assert.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>
#include <signal.h>
#include <assert.h>
#include <time.h>

#include <readline/readline.h>
#include <readline/history.h>

#include "command.h"
#include "joblist.h"
#include "terminal.h"

#define NAME "The Shellder Wand"
#define PROMPT "> "
#define HIST_FILE ".shell_history"

/**
 * Reaps (checks and updates status), reports (depending on choice), 
 * and deletes (from joblist) any terminated background processes
 * 
 * if choice is 0 -- just reap job (mark as done and delete)
 * if choice is 1 -- print reaped jobs only
 * if choice is 2 -- print all jobs (done, running, and stopped)
 */ 
void reapChild(JobList* jobs, Job* job, int choice) {
  // jobs and job asserted in job_iter
  pid_t job_pid = job->pid; // pid of current job
  assert(job_pid > 0);

  // process with pid job_pid has terminated
  if (job_pid == waitpid(job_pid, NULL, WNOHANG)) {
    
    job_set_status(jobs, job, JOB_STATUS_DONE); // update job status

    if (choice > 0) 
      job_print(jobs, job); // report reaped job

    job_delete(jobs,job); // delete job / kill the undead
  }
  else if (choice == 2) // job has not terminated (printing for jobs command)
    job_print(jobs, job);
}

/**
 * Helper function for exit and ^D
 * Informs user of existing commands in joblist if user tries to exit
 * Frees joblist if no jobs exist
 * The second parameter, if not NULL, is used to politely exit and cleanup if Ctrl-D is called
 *
 * returns 1 if user cannot exit (jobs still exist)
 */
int politeExit(JobList* jobs, int* ctrlD) {

  job_iter3(jobs, 0, reapChild); // reap done jobs -- does not "report"

  if (!joblist_empty(jobs)) { // if joblist still contains jobs, user cannot exit

    printf("There are unfinished jobs.\n");
    job_iter2(jobs, job_print); //print the processes still running or still stopped
    if (ctrlD) //if ctrlD was used -- useful for while-loop in main()
      *ctrlD = 1;
    
    return 1;      
  }

  // joblist_free assumes free joblist
  joblist_free(jobs); // free joblist before exiting
  exit(0);
}

/**
 * Place the process with the given pid in the foreground and wait for it.
 *
 * Exit in error if an error occurs while waiting. (Part 1)
 *
 * Return 0 if process pid terminated  (Part 2)
 *        1 if process pid stopped     (Part 3)
 *       -1 if something went wrong but error checking did not catch it
 */
int shell_wait_fg(pid_t pid) {
 
  int status; // to store waitpid status
  int stopCheck = waitpid(pid, &status, WUNTRACED);

  if(stopCheck == -1) { //error-checking; waitpid failed
    perror("wait");
    exit(1);
  }
  else if(stopCheck == pid) { // if process pid terminated or stopped
    // if exited status says terminated normally or terminated by signal (CTRL-C)
    if (WIFEXITED(status) || WIFSIGNALED(status)) {
      return 0;
    }
    else if (WIFSTOPPED(status)) { // status says job is stopped via signal
      return 1;
    }
  }

  return -1; // something went wrong but not caught by errors
}
 

/**
 * Fork and exec the requested program in the foreground (Part 1)
 * or background (Part 2).
 *
 * Exit in error if an error occurs while forking/waiting.            (Part 1)
 *
 * Return 0 if foreground process forked successfully and terminated. (Part 1)
 *        0 if background process forked successfully.                (Part 2)
 *        1 if foreground process forked successfully and stopped.    (Part 3)
 *       -1 if an something went wrong, but error not caught
 *
 * Use shell_wait_fg to do all waiting.
 * During Part 1, pass NULL for the `jobs` argument when calling.
 */
int shell_run_job(JobList* jobs, char** command, int foreground, Job* currentJob) {

  /* For parent process, pid == child's pid;
   * For child  process, pid == 0 */
  pid_t pid = fork();

  // Error-checking for fork
  if (pid < 0) {
    perror("fork");
    exit(1);
  }

  Job* current = currentJob;
  if (pid == 0) { // Child process.
    term_child_init(jobs, foreground); // Set up terminal and signals in child process.
    if (execvp(*command, command) == -1) { // Error-checking in exec
      perror("exec");
      exit(1);
    }
  }
  else { // Parent process.
    if (foreground) { // If foreground, save job with status
      if (!currentJob) { // create job if currentJob parameter is null
	current = job_save(jobs, pid, command, JOB_STATUS_FOREGROUND);
      }
      term_give(jobs, current); //pass foreground status from shell to child
      int waitStatus = shell_wait_fg(pid); // wait for child
      
      // hand control back to current/previous command
      term_take(jobs, current);

      if (waitStatus == 0) { // if child terminated successfully (either normally or via signal)
	// delete immediately upon completion (frees command, frees job)
	job_delete(jobs, current);
	return 0;
      }
      else if(waitStatus == 1) { // if child process is successfully stopped
	job_set_status(jobs, current, JOB_STATUS_STOPPED); // update status
	job_print(jobs, current); // report the stopped job
	return 1;
      }
    }
    else { // background process; create, report, don't wait for child

      if (!currentJob) //create new job if currentJob parameter is null
	current = job_save(jobs, pid, command, JOB_STATUS_BACKGROUND); //creating
      job_print(jobs, current); //reporting
      return 0;
    }
  }
  return -1; // -1 if erroneous and error not caught; should never get here
}

/**
 * If command is built-in, do it directly and return 1,
 * otherwise return 0.
 */
int shell_builtin(JobList* jobs, char** command) {
  
  char** cursor = command;
  
  if (*cursor == NULL) // If command is simply a return.
    return 1;
  else if (strcmp(*cursor, "exit") == 0) {
    politeExit(jobs, NULL); // If appropriate, helper function exits; returns if not.
    return 1;
  }
  else if (strcmp(*cursor, "help") == 0) {
    // Currently supports four built-in commands: cd, exit, help, jobs, fg, bg.
    printf("cd [-L|-P] [dir]\nexit\nhelp [-dms] [pattern ...]\njobs[-lnprs] [jobspec ...]\n\
fg [job_spec]\nbg [job_spec]\n");
    return 1;
  }
  else if (strcmp(*cursor, "cd") == 0) {
    cursor++; // Look at the next word in command array.
    if (*cursor) { // If there's a second word
      chdir(*cursor);
    }
    else { // Else no second word; go to directory path given by HOME env
      char* dir = getenv("HOME"); // Get the environment variable,
      chdir(dir); // Change to the directory given by dir.
    }
    return 1;
  }
  else if (strcmp(*cursor, "jobs") == 0) {
    job_iter3(jobs, 2, reapChild); // Reap and print all jobs.
    //job_iter(jobs, job_print); // Print any remaining (running or stopped) jobs.
    return 1;
  }
  else if (strcmp(*cursor, "fg") == 0 || strcmp(*cursor, "bg") == 0) {
    int foreground = strcmp(*cursor, "fg") == 0;
    Job* job;
    cursor++; // Look at next word in the command array.
    if (*cursor) // If job ID given
      job = job_get(jobs, strtol(*cursor, NULL, 0));
    else // Else no jid provided. Act on current job, if any
      job = job_get_current(jobs);
    
    if (job) { // If job exists
      if (foreground)
	job_set_status(jobs, job, JOB_STATUS_FOREGROUND);
      else
	job_set_status(jobs, job, JOB_STATUS_BACKGROUND);
      shell_run_job(jobs, job->command, foreground, job);
    }
    else
      printf("Entered job ID is not valid or no background job exists.\n");
    return 1;
  }
 return 0;
}

/**
 * Main shell loop: read, parse, and execute commands.
 */
int main(int argc, char** argv) {

  // Load history if available.
  using_history();
  read_history(HIST_FILE);

  term_shell_init(jobs); // Sets up shell's interaction with terminal.
  JobList* jobs = joblist_create();
  char* line = NULL;
  int ctrl_D = 0;

  /* Enter while loop if input is not EOF character, or 
   * if given EOF character (CTRL-D), there are still stopped or running jobs
   * politeExit is a helper function that facilitates a polite ^D */
  while ((line = readline(PROMPT)) || (politeExit(jobs, &ctrl_D) == 1)) {
    if (ctrl_D == 1) { // If ctrl-D used but jobs still exists,
      ctrl_D = 0; // return to command prompt.
      continue;
    }
    add_history(line); // Add line to history.
    int fg = -1;
    char** command = command_parse(line, &fg); // Parse, allocate command array.
    free(line);

    if (command) { // If command is non-NULL,
      // first, send command to built-in. 
      if (shell_builtin(jobs, command) == 0) { // If it is executable,
	shell_run_job(jobs, command, fg, NULL); // run it.
      }
      else { // Else command is built-in, so
	command_free(command); // free command.
      }
      // Reap, report, print done jobs after each command.
      job_iter3(jobs, 1, reapChild);
   }
  }
  return 0; // should exit from call to politeExit; should never reach this
}
