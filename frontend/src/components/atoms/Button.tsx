
import styles from './Button.module.css'

type ButtonProps = {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'tertiary'
    className?: string
}

export function Button({
    children,
    onClick,
    disabled = false,
    type = 'button',
    variant = 'primary',
    className = '',
}: ButtonProps) {


    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${styles.buttonBase} ${styles[variant]} ${className}`}
        >
            {children}
        </button>
    )
}