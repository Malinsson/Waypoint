
import styles from './Button.module.css'

type ButtonProps = {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'tertiary'
    className?: string
    // Needed when the content is only an icon
    'aria-label'?: string
    // Lets a parent move focus here, e.g. after the button it was on disappeared
    ref?: React.Ref<HTMLButtonElement>
}

export function Button({
    children,
    onClick,
    disabled = false,
    type = 'button',
    variant = 'primary',
    className = '',
    'aria-label': ariaLabel,
    ref,
}: ButtonProps) {


    return (
        <button
            ref={ref}
            type={type}
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            className={`decorativeBorder ${styles.buttonBase} ${styles[variant]} ${className}`}
        >
            {children}
        </button>
    )
}
