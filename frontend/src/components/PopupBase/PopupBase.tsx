import styles from './PopupBase.module.css'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

type PopupBaseProps = {
  children: React.ReactNode
  onCancel: () => void
  isOpen: boolean
  onConfirm?: () => void
}



function PopupBase({ children, onCancel, isOpen }: PopupBaseProps) {

    const popupRef = useRef<HTMLDivElement>(null);

    // Callers usually pass an inline arrow function, which is a new function on
    // every render. If the keyboard effect depended on it, every re-render
    // (e.g. each keystroke in a form inside the popup) would re-run the effect
    // and move focus back to the first field. So the latest one is kept in a ref.
    const onCancelRef = useRef(onCancel);
    useEffect(() => {
        onCancelRef.current = onCancel;
    });
    
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
                onCancelRef.current();
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


    }, [isOpen]);


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
    <div className={styles.overlay}>
        <div 
        ref={popupRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`decorativeBorder ${styles.popupBase}`}>
        {children}
        </div>
    </div>,
    document.body,
  )
}

export default PopupBase