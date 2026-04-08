"use client";

import { useActionState } from "react";
import { createClientAction } from "@/modules/clients/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface CreateClientDialogProps {
  onClose: () => void;
}

export function CreateClientDialog({ onClose }: CreateClientDialogProps) {
  const [state, action, pending] = useActionState(createClientAction, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-dark-3 bg-dark-2 p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray hover:text-white transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        <h2 className="mb-1 text-lg font-bold text-white">Add Client</h2>
        <p className="mb-6 text-sm text-gray">
          Add a new client company to manage
        </p>

        <form action={action} className="space-y-4">
          {state.error && (
            <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              {state.error}
            </div>
          )}

          <Input
            id="name"
            name="name"
            label="Company Name"
            placeholder="SC Example SRL"
            required
            autoFocus
          />

          <Input
            id="cui"
            name="cui"
            label="CUI (optional)"
            placeholder="RO12345678"
          />

          <Input
            id="caen"
            name="caen"
            label="CAEN Code (optional)"
            placeholder="6201"
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Creating..." : "Create Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
