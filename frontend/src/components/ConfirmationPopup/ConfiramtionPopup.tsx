import styles from './ConfirmationPopup.module.css';
import { Button } from '../atoms/Button';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ConfirmationPopupProps = {
  message: string;
  isOpen?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function ConfirmationPopup({ message, isOpen, onConfirm, onCancel }: ConfirmationPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const app = document.getElementById("root");

        if (!app || !isOpen) return;

        app.inert = true;

        return () => {
            app.inert = false;
        };
    }, [isOpen]);

    // Handle keyboard events
    useEffect(() => {
        if (!isOpen) return;

        const popup = popupRef.current;
        if (!popup) return;

        const previouslyFocused = document.activeElement as HTMLElement;

        const focusableSelector = [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
        ].join(",");

        const getFocusableElements = () =>
        Array.from(
            popup.querySelectorAll<HTMLElement>(focusableSelector)
        );

        // Focus first element
        const focusableElements = getFocusableElements();
        focusableElements[0]?.focus();

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onCancel();
                return;
            }

            if (event.key !== "Tab") return;

            const elements = getFocusableElements();

            if (elements.length === 0) {
                event.preventDefault();
                popup?.focus();
                return;
            }

            const first = elements[0];
            const last = elements[elements.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
            };

            document.addEventListener("keydown", handleKeyDown);

            return () => {
            document.removeEventListener("keydown", handleKeyDown);
            previouslyFocused?.focus();
            };


    }, [isOpen, onCancel]);


    // Close the popup when clicking outside of it
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            if (target.classList.contains(styles.overlay)) {
                onCancel();
            }
        }

        window.addEventListener('click', handleClickOutside);

        return () => {
            window.removeEventListener('click', handleClickOutside);
        }
    }, [onCancel]);


    // Prevent background scrolling when the popup is open
    useEffect(() => {
    if (!isOpen) return;

    const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
    };
    }, [isOpen]);

    if (!isOpen) return null;



  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
        <div
        ref={popupRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={styles.popup}
        >
            <p>{message}</p>
            <div className={styles.actions}>
                <Button type="button" onClick={onConfirm}>Confirm</Button>
                <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            </div>
        </div>
    </div>,
    document.body,
  );
}

export default ConfirmationPopup;